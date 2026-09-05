/**
 * server.js - Express 主服务入口
 * 
 * 功能：
 * - 用户注册 / 登录 / 登出
 * - 抽卡页面渲染
 * - 抽卡 API（加权随机）
 * - 静态文件服务（CSS / JS / 图片）
 */

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
    initDatabase,
    getAllCards,
    getCardById,
    getUserById,
    getUserByUsername,
    createUser,
    verifyUser,
    incrementPulls,
    getDailyPullInfo,
    recordDailyPull,
    savePullHistory,
    getUserPullHistory,
    closeDatabase,
    getDb,
    getAllUsersWithStats,
    banUser,
    unbanUser,
    getAllNews,
    getNewsById,
    getAllPosts,
    getPostById,
    incrementPostViews,
    countPostsByAuthor,
    getSiteStats,
    createPost,
    updatePost,
    deletePost,
    getCommentsByPost,
    createComment,
    deleteComment,
} = require('./db');

// ============================================================
// IndexNow 即时收录配置（Bing / Yandex / Seznam / Naver）
// IndexNow key 文件必须能通过 https://域名/<key>.txt 访问
// ============================================================
const SITE_HOST = '41nb.dpdns.org';
const INDEXNOW_KEY = 'c48458928cbf6a2f94ffae6833159e0a';

/**
 * 提交 URL 到 IndexNow，通知搜索引擎即时抓取
 * @param {string[]} urls 完整 URL 列表
 */
async function submitIndexNow(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return;
    const payload = {
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
    };
    try {
        const res = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(payload),
        });
        console.log('[IndexNow] 提交 ' + urls.length + ' 个URL, 状态: ' + res.status);
    } catch (e) {
        console.error('[IndexNow] 推送失败: ' + e.message);
    }
}

// ---- 创建 Express 应用 ----
const app = express();
const PORT = process.env.PORT || 3000;

// ---- 启动时扫描图片文件夹，建立 cardId → 文件名 的映射 ----
const CARDS_DIR = path.join(__dirname, 'public', 'images', 'cards');
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
let cardImageMap = {}; // { 1: '1.png', 2: '2.jpg', ... }

function scanCardImages() {
    cardImageMap = {};
    if (!fs.existsSync(CARDS_DIR)) return;
    const files = fs.readdirSync(CARDS_DIR);
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!IMAGE_EXTS.includes(ext)) continue;
        const name = path.basename(file, ext); // 不带扩展名的文件名
        const num = parseInt(name, 10);
        if (!isNaN(num)) {
            cardImageMap[num] = file; // 例如 cardImageMap[1] = '1.png'
        }
    }
    console.log('[图片] 扫描到 ' + Object.keys(cardImageMap).length + ' 张卡牌图片');
}

scanCardImages();

// 提供一个函数给外面用，获取卡牌图片文件名
function getCardImage(cardId) {
    return cardImageMap[cardId] || null;
}

// ---- 中间件配置 ----

// 解析 URL 编码的表单数据（登录/注册表单）
app.use(express.urlencoded({ extended: true }));

// 解析 JSON 请求体（抽卡 API）
app.use(express.json());

// 动态 sitemap.xml：列出所有公开页面 + 全部博客文章，新发文章自动收录
app.get('/sitemap.xml', (req, res) => {
    const origin = `https://${req.get('host')}`;
    const pages = [
        { loc: '/', priority: 1.0, changefreq: 'daily' },
        { loc: '/blog', priority: 0.9, changefreq: 'daily' },
        { loc: '/login', priority: 0.3, changefreq: 'monthly' },
        { loc: '/register', priority: 0.3, changefreq: 'monthly' },
    ];
    const posts = getAllPosts();
    posts.forEach((p) => {
        let lastmod = (p.updated_at && p.created_at !== p.updated_at) ? p.updated_at : p.created_at;
        if (lastmod && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(lastmod)) {
            lastmod = lastmod.replace(' ', 'T') + 'Z';
        }
        pages.push({ loc: `/blog/${p.id}`, priority: 0.8, changefreq: 'weekly', lastmod });
    });
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    pages.forEach((p) => {
        xml += '  <url>\n';
        xml += '    <loc>' + origin + p.loc + '</loc>\n';
        if (p.lastmod) xml += '    <lastmod>' + p.lastmod + '</lastmod>\n';
        if (p.changefreq) xml += '    <changefreq>' + p.changefreq + '</changefreq>\n';
        if (p.priority != null) xml += '    <priority>' + p.priority + '</priority>\n';
        xml += '  </url>\n';
    });
    xml += '</urlset>';
    res.set('Cache-Control', 'no-store').type('application/xml').send(xml);
});

// 动态 robots.txt：允许抓取，指向 sitemap
app.get('/robots.txt', (req, res) => {
    const origin = `https://${req.get('host')}`;
    res.set('Cache-Control', 'no-store').type('text/plain').send(
        'User-agent: *\n' +
        'Allow: /\n' +
        `Sitemap: ${origin}/sitemap.xml\n`
    );
});

// 静态文件服务（CSS、JS、图片等）
app.use(express.static(path.join(__dirname, 'public')));

// Session 配置
app.use(session({
    secret: 'gacha-site-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,  // 24 小时过期
        httpOnly: true,
    },
}));

// 模板引擎设置为 EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// ============================================================
// 中间件：每次请求前，把当前登录用户挂到 res.locals 上
// 这样所有 EJS 模板都能通过 `user` 变量访问当前用户信息
// ============================================================
app.use((req, res, next) => {
    res.locals.user = null;
    if (req.session && req.session.userId) {
        const user = getUserById(req.session.userId);
        if (user) {
            // 封号用户踢下线
            if (user.banned === 1) {
                req.session.destroy(() => {
                    res.redirect('/login?banned=1');
                });
                return;
            }
            res.locals.user = user;
        }
    }
    next();
});


// ============================================================
// 登录保护中间件
// 用于需要登录才能访问的页面（抽卡页面、抽卡 API）
// ============================================================
function requireLogin(req, res, next) {
    if (!res.locals.user) {
        // 未登录，跳转到登录页
        return res.redirect('/login');
    }
    next();
}

// 游客每日抽卡上限（与登录用户一致）
const GUEST_DAILY_LIMIT = 10;

// 全局无限抽卡开关：true = 不限次数（卡池小，暂时放开），false = 每日限额
const UNLIMITED_PULLS = true;

function getServerToday() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

function getGuestDrawSession(req) {
    if (!req.session.guest) req.session.guest = { date: '', count: 0 };
    const today = getServerToday();
    if (req.session.guest.date !== today) {
        req.session.guest = { date: today, count: 0 };
    }
    return req.session.guest;
}


// ============================================================
// 路由定义
// ============================================================

/**
 * 首页 GET /
 * 已登录 → 跳转抽卡页
 * 未登录 → 跳转登录页
 */
app.get('/', (req, res) => {
    res.redirect('/gacha');
});


// ---- 注册 ----

/**
 * GET /register - 显示注册页面
 */
app.get('/register', (req, res) => {
    // 如果已经登录，直接跳转抽卡页
    if (res.locals.user) {
        return res.redirect('/gacha');
    }
    res.locals.error = null;
    res.render('register');
});

/**
 * POST /register - 处理注册请求
 */
app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    // 简单的输入验证
    if (!username || username.trim().length < 2) {
        res.locals.error = '用户名至少需要 2 个字符';
        return res.render('register');
    }
    if (!password || password.length < 6) {
        res.locals.error = '密码至少需要 6 个字符';
        return res.render('register');
    }

    // 邮箱验证（任意邮箱均可，仅 QQ 邮箱用于获取头像）
    if (!email || !email.trim()) {
        res.locals.error = '请输入邮箱';
        return res.render('register');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        res.locals.error = '请输入正确的邮箱地址（如：123456@qq.com）';
        return res.render('register');
    }

    // 尝试创建用户
    const result = await createUser(username.trim(), password, email.trim());

    if (result.success) {
        // 注册成功，跳转到登录页
        res.redirect('/login?registered=1');
    } else {
        // 注册失败，显示错误信息
        res.locals.error = result.message;
        res.render('register');
    }
});


// ---- 登录 ----

/**
 * GET /login - 显示登录页面
 */
app.get('/login', (req, res) => {
    // 如果已经登录，直接跳转抽卡页
    if (res.locals.user) {
        return res.redirect('/gacha');
    }
    // 检查是否刚注册成功
    res.locals.error = null;
    res.locals.registered = req.query.registered === '1';
    res.locals.banned = req.query.banned === '1';
    res.render('login');
});

/**
 * POST /login - 处理登录请求
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // 简单的输入验证
    if (!username || !password) {
        res.locals.error = '请输入用户名和密码';
        res.locals.registered = false;
        res.locals.banned = false;
        return res.render('login');
    }

    // 验证用户
    const result = await verifyUser(username.trim(), password);

    if (result.success) {
        // 登录成功，保存用户 ID 到 session
        req.session.userId = result.user.id;
        res.redirect('/gacha');
    } else {
        // 登录失败
        res.locals.error = result.message;
        res.locals.registered = false;
        res.locals.banned = false;
        res.render('login');
    }
});


// ---- 登出 ----

/**
 * GET /logout - 清除 session，跳转登录页
 */
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


// ---- 抽卡页面 ----

/**
 * GET /gacha - 抽卡主页面（需要登录）
 */
app.get('/gacha', (req, res) => {
    const user = res.locals.user;
    if (user) {
        const dailyInfo = getDailyPullInfo(user.id);
        res.locals.dailyPulls = dailyInfo.daily_pulls;
        res.locals.remaining = dailyInfo.remaining;
        res.locals.isAdmin = user.is_admin === 1;
    } else {
        const guest = getGuestDrawSession(req);
        res.locals.dailyPulls = guest.count;
        res.locals.remaining = GUEST_DAILY_LIMIT - guest.count;
        res.locals.isAdmin = false;
    }
    res.locals.isUnlimited = UNLIMITED_PULLS || res.locals.isAdmin;
    res.render('gacha');
});


// ---- 抽卡历史页面 ----

/**
 * GET /history - 查看抽卡历史（需要登录）
 */
app.get('/history', requireLogin, (req, res) => {
    const history = getUserPullHistory(res.locals.user.id);
    res.locals.history = history;
    res.render('history');
});


// ---- 抽卡 API ----

/**
 * POST /api/draw - 抽卡接口（需要登录）
 * 
 * 抽卡算法：
 * 1. 获取所有卡牌
 * 2. 计算总权重
 * 3. 生成 [0, 总权重) 之间的随机数
 * 4. 累加权重直到覆盖随机数，命中的就是抽到的卡牌
 */
app.post('/api/draw', (req, res) => {
    try {
        const isGuest = !res.locals.user;
        const userId = isGuest ? null : res.locals.user.id;
        const isAdmin = !isGuest && res.locals.user.is_admin === 1;
        const cardId = req.body.cardId; // 管理员指定卡牌ID

        let clientDaily = 0;
        let clientRemaining = isAdmin ? 999 : 0;
        const isUnlimited = isAdmin || UNLIMITED_PULLS;

        // 游客与登录用户一样有每日限额，管理员跳过；无限模式下所有人不检查
        if (!isUnlimited) {
            if (isGuest) {
                const guest = getGuestDrawSession(req);
                if (guest.count >= GUEST_DAILY_LIMIT) {
                    return res.json({
                        success: false,
                        error: '今日抽卡次数已用完，明天再来吧！',
                        dailyLimitReached: true,
                        daily_pulls: guest.count,
                        remaining: 0,
                    });
                }
                guest.count++;
                clientDaily = guest.count;
                clientRemaining = GUEST_DAILY_LIMIT - guest.count;
            } else {
                const dailyInfo = getDailyPullInfo(userId);
                if (dailyInfo.remaining <= 0) {
                    return res.json({
                        success: false,
                        error: '今日抽卡次数已用完，明天再来吧！',
                        dailyLimitReached: true,
                        daily_pulls: dailyInfo.daily_pulls,
                        remaining: 0,
                    });
                }
            }
        } else if (isGuest) {
            const guest = getGuestDrawSession(req);
            guest.count++;
            clientDaily = guest.count;
            clientRemaining = 999;
        }

        let selectedCard = null;

        // 管理员指定了卡牌ID
        if (isAdmin && cardId) {
            selectedCard = getCardById(Number(cardId));
            if (!selectedCard) {
                return res.json({ success: false, error: '找不到 ID 为 ' + cardId + ' 的卡牌' });
            }
        } else {
            // 随机抽卡
            const cards = getAllCards();
            if (cards.length === 0) {
                return res.json({ success: false, error: '卡池为空，没有卡牌可以抽取' });
            }
            const totalWeight = cards.reduce((sum, card) => sum + card.weight, 0);
            let random = Math.random() * totalWeight;
            for (const card of cards) {
                random -= card.weight;
                if (random <= 0) {
                    selectedCard = card;
                    break;
                }
            }
            if (!selectedCard) {
                selectedCard = cards[cards.length - 1];
            }
        }

        let updatedUser = null;
        let newDailyInfo = null;
        if (!isGuest) {
            // 更新次数（管理员也记录，但不检查限额），游客不保存记录
            incrementPulls(userId);
            newDailyInfo = recordDailyPull(userId);
            clientDaily = newDailyInfo.daily_pulls;
            clientRemaining = isUnlimited ? 999 : newDailyInfo.remaining;

            savePullHistory(userId, selectedCard.name, selectedCard.rarity, selectedCard.description, getCardImage(selectedCard.id));

            updatedUser = getUserById(userId);
        }

        const rarityColors = {
            'N':    '#9ca3af',
            'R':    '#4a9eff',
            'SR':   '#a855f7',
            'SSR':  '#f59e0b',
            'SSSR': '#ff4444',
        };

        res.json({
            success: true,
            card: {
                id: selectedCard.id,
                name: selectedCard.name,
                rarity: selectedCard.rarity,
                description: selectedCard.description,
                image: getCardImage(selectedCard.id) || '',
                color: rarityColors[selectedCard.rarity] || '#ffffff',
            },
            pulls: isGuest ? clientDaily : updatedUser.pulls,
            daily_pulls: clientDaily,
            remaining: isAdmin ? 999 : clientRemaining,
            isAdmin: isAdmin,
        });

    } catch (error) {
        console.error('[API] 抽卡出错:', error);
        res.json({ success: false, error: '抽卡服务异常，请稍后重试' });
    }
});


// ============================================================
// 启动服务器
// ============================================================

// 先初始化数据库，再启动服务器
initDatabase();

// 管理员兜底：仅当全站没有任何管理员时，才自动创建一个 admin 账号
(async () => {
    const db = getDb();
    const adminCount = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_admin = 1').get().c;
    if (adminCount === 0) {
        await require('./db').createUser('admin', 'xxld2252');
        db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('admin');
        console.log('[Admin] 无管理员账号，已自动创建 admin / xxld2252');
    }
})();

// 管理员：获取所有卡牌列表
app.get('/api/cards', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.json({ success: false, error: '无权限' });
    }
    const cards = getAllCards();
    res.json({ success: true, cards });
});


// ---- 公告页面 ----

/**
 * GET /news - 公告列表
 */
app.get('/news', requireLogin, (req, res) => {
    const news = getAllNews();
    news.forEach((item) => {
        item.contentHtml = renderPostContent(item.content || '');
    });
    res.locals.newsList = news;
    res.render('news');
});

/**
 * GET /news/:id - 公告详情
 */
app.get('/news/:id', requireLogin, (req, res) => {
    const article = getNewsById(Number(req.params.id));
    if (!article) {
        return res.status(404).send('公告不存在');
    }
    res.locals.article = article;
    article.contentHtml = renderPostContent(article.content || '');
    res.render('news-detail');
});


// ---- 管理员面板 ----

/**
 * GET /admin - 管理员页面（查看所有用户、封号/解封）
 */
app.get('/admin', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.status(403).send('无权限');
    }
    const users = getAllUsersWithStats();
    res.locals.users = users;
    res.render('admin');
});

/**
 * POST /api/ban/:id - 封号
 */
app.post('/api/ban/:id', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.json({ success: false, error: '无权限' });
    }
    const targetId = Number(req.params.id);
    if (targetId === res.locals.user.id) {
        return res.json({ success: false, error: '不能封自己' });
    }
    banUser(targetId);
    res.json({ success: true });
});

/**
 * POST /api/unban/:id - 解封
 */
app.post('/api/unban/:id', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.json({ success: false, error: '无权限' });
    }
    unbanUser(Number(req.params.id));
    res.json({ success: true });
});

// ---- 图片上传 ----
const BLOG_IMG_DIR = path.join(__dirname, 'public', 'images', 'blog');
if (!fs.existsSync(BLOG_IMG_DIR)) fs.mkdirSync(BLOG_IMG_DIR, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: BLOG_IMG_DIR,
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

app.post('/api/upload', requireLogin, upload.single('image'), (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.json({ success: false, error: '无权限' });
    }
    if (!req.file) {
        return res.json({ success: false, error: '上传失败，请检查文件格式' });
    }
    const url = '/images/blog/' + req.file.filename;
    res.json({ success: true, url: url });
});

// ============================================================
// 博客路由
// ============================================================

/**
 * 简易 Markdown 解析
 * 支持：标题(#/##/###) / 代码块(```) / 行内代码(`) / 加粗(**)
 * 斜体(*) / 删除线(~~) / 列表(-/数字.) / 引用(>) / 分割线(---)
 * 图片(img:) / 链接([text](url)) / 换行
 */
function renderPostContent(raw) {
    let text = raw.replace(/\r/g, '');

    // ---- 1. 提取并保护代码块（避免被其他解析器破坏）----
    const codeBlocks = [];
    text = text.replace(/```[^\n]*(?:\n)?([\s\S]*?)```/g, (m, code) => {
        codeBlocks.push(code);
        return '\x00CODEBLOCK' + (codeBlocks.length - 1) + '\x00';
    });

    // ---- 2. 提取并保护行内代码 ----
    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, (m, code) => {
        inlineCodes.push(code);
        return '\x00INLINECODE' + (inlineCodes.length - 1) + '\x00';
    });

    // ---- 3. 提取并保护图片行（img:xxx）----
    const images = [];
    text = text.replace(/^img:[ \t]*(\S+)[ \t]*$/gm, (m, src) => {
        images.push(src);
        return '\x00IMG' + (images.length - 1) + '\x00';
    });

    // ---- 3.5 提取并保护表格 ----
    const tables = [];
    text = text.replace(/((?:^\|.+\|$\n?)+)/gm, (block) => {
        const rows = block.trim().split('\n').filter(r => /^\|.+\|$/.test(r));
        if (rows.length < 2) return block;
        const isSep = (r) => /^\|[\s\-:|]+\|$/.test(r);
        if (!isSep(rows[1])) return block;
        const dataRows = rows.filter((_, i) => i !== 1);
        let html = '<table class="blog-table"><thead><tr>';
        dataRows[0].split('|').slice(1, -1).forEach(c => { html += '<th>' + c.trim() + '</th>'; });
        html += '</tr></thead><tbody>';
        for (let i = 1; i < dataRows.length; i++) {
            html += '<tr>';
            dataRows[i].split('|').slice(1, -1).forEach(c => { html += '<td>' + c.trim() + '</td>'; });
            html += '</tr>';
        }
        html += '</tbody></table>';
        tables.push(html);
        return '\x00TABLE' + (tables.length - 1) + '\x00';
    });

    // ---- 4. 逐行解析：标题 / 引用 / 列表 / 分割线 / 段落 ----
    // （每行内容在循环内单独转义，代码/图片内容已被占位符保护不受影响）
    const lines = text.split('\n');
    const html = [];
    let listOpen = false;
    let listType = null;

    const closeList = () => {
        if (listOpen) {
            html.push('</' + listType + '>');
            listOpen = false;
            listType = null;
        }
    };

    for (const rawLine of lines) {
        const line = escapeHtml(rawLine);

        // 空行：关闭列表
        if (line.trim() === '') {
            closeList();
            continue;
        }

        // 代码块/图片占位符行：原样输出
        if (/^\x00(?:CODEBLOCK|IMG)\d+\x00$/.test(line)) {
            closeList();
            html.push(line);
            continue;
        }

        // 表格占位符行：原样输出
        if (/^\x00TABLE\d+\x00$/.test(line)) {
            closeList();
            html.push(line);
            continue;
        }

        // 标题 ### / ## / #
        let m = line.match(/^###\s+(.+)$/);
        if (m) { closeList(); const id = 'toc-' + m[1].trim().replace(/\s+/g, '-'); html.push('<h3 class="blog-h3" id="' + escapeHtml(id) + '">' + m[1] + '</h3>'); continue; }
        m = line.match(/^##\s+(.+)$/);
        if (m) { closeList(); const id = 'toc-' + m[1].trim().replace(/\s+/g, '-'); html.push('<h2 class="blog-h2" id="' + escapeHtml(id) + '">' + m[1] + '</h2>'); continue; }
        m = line.match(/^#\s+(.+)$/);
        if (m) { closeList(); const id = 'toc-' + m[1].trim().replace(/\s+/g, '-'); html.push('<h1 class="blog-h1" id="' + escapeHtml(id) + '">' + m[1] + '</h1>'); continue; }

        // 引用（> 已被转义为 &gt;）
        m = line.match(/^&gt;\s*(.+)$/);
        if (m) { closeList(); html.push('<blockquote class="blog-quote">' + m[1] + '</blockquote>'); continue; }

        // 分割线
        if (/^\s*(---|___|\*\*\*)\s*$/.test(line)) {
            closeList();
            html.push('<hr class="blog-hr">');
            continue;
        }

        // 无序列表
        m = line.match(/^\s*[-*]\s+(.+)$/);
        if (m) {
            if (!listOpen || listType !== 'ul') {
                closeList();
                html.push('<ul class="blog-ul">');
                listOpen = true;
                listType = 'ul';
            }
            html.push('<li>' + m[1] + '</li>');
            continue;
        }

        // 有序列表
        m = line.match(/^\s*\d+\.\s+(.+)$/);
        if (m) {
            if (!listOpen || listType !== 'ol') {
                closeList();
                html.push('<ol class="blog-ol">');
                listOpen = true;
                listType = 'ol';
            }
            html.push('<li>' + m[1] + '</li>');
            continue;
        }

        // 普通段落
        closeList();
        html.push('<p class="blog-p">' + line + '</p>');
    }
    closeList();

    text = html.join('\n');

    // ---- 6. 行内格式 ----
    // 链接
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="blog-post-link" target="_blank">$1</a>');
    // 加粗
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 斜体
    text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    // 删除线
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // ---- 7. 恢复行内代码 ----
    text = text.replace(/\x00INLINECODE(\d+)\x00/g, (mm, i) => {
        const code = inlineCodes[Number(i)];
        return '<code class="blog-inline-code">' + escapeHtml(code) + '</code>';
    });

    // ---- 8. 恢复图片 ----
    text = text.replace(/\x00IMG(\d+)\x00/g, (mm, i) => {
        return '<img src="' + escapeHtml(images[Number(i)]) + '" class="blog-post-img">';
    });

    // ---- 8.5 恢复表格 ----
    text = text.replace(/\x00TABLE(\d+)\x00/g, (mm, i) => {
        return tables[Number(i)];
    });

    // ---- 9. 恢复代码块 ----
    text = text.replace(/\x00CODEBLOCK(\d+)\x00/g, (mm, i) => {
        const code = codeBlocks[Number(i)];
        return '<pre class="blog-code-block"><code>' + escapeHtml(code) + '</code></pre>';
    });

    return text;
}

/**
 * HTML 转义工具
 */
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * GET /blog - 博客列表页（所有人可看）
 */
app.get('/blog', (req, res) => {
    const posts = getAllPosts();
    res.render('blog', { posts });
});

/**
 * GET /blog/:id - 文章详情页（所有人可看）
 */
app.get('/blog/:id', (req, res) => {
    const post = getPostById(Number(req.params.id));
    if (!post) {
        return res.status(404).render('404');
    }
    post.contentHtml = renderPostContent(post.content);
    const comments = getCommentsByPost(post.id);
    incrementPostViews(post.id);
    const author = getUserByUsername(post.author) || null;
    const sidebar = {
        authorName: post.author,
        authorAvatar: author ? author.avatar : null,
        totalPosts: countPostsByAuthor(post.author),
        views: post.views || 0,
        // 目录：从内容提取标题
        toc: (post.content || '').split('\n')
            .map(line => {
                const m = line.match(/^(#{1,3})\s+(.+)$/);
                if (!m) return null;
                return { level: m[1].length, text: m[2].trim() };
            })
            .filter(Boolean),
        // 阅读时间（中文按每分钟300字估算）
        readTime: Math.max(1, Math.ceil((post.content || '').length / 300)),
        // 发布时间
        createdAt: post.created_at,
        // 全站统计
        siteStats: getSiteStats(),
        // 公告
        announcement: '欢迎来到 AD酱の博客！\n \n这里分享AD酱的技术教程和有趣的工具，随时可以找AD酱交流哦！\n qq群：1105949098\n \n祝大家抽卡好运！',
    };
    res.render('blog-detail', { post, comments, sidebar: sidebar });
});

/**
 * GET /blog/admin/new - 发布新文章（管理员）
 */
app.get('/blog/admin/new', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.redirect('/blog');
    }
    res.render('blog-admin', { post: null });
});

/**
 * POST /blog/admin/new - 保存新文章
 */
app.post('/blog/admin/new', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.redirect('/blog');
    }
    const { title, content, summary, cover } = req.body;
    if (!title || !content) {
        return res.render('blog-admin', { post: null, error: '标题和内容不能为空' });
    }
    const id = createPost(title, content, summary, cover, res.locals.user.username);
    submitIndexNow([`https://${SITE_HOST}/blog/${id}`]);
    res.redirect('/blog/' + id);
});

/**
 * GET /blog/admin/edit/:id - 编辑文章（管理员）
 */
app.get('/blog/admin/edit/:id', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.redirect('/blog');
    }
    const post = getPostById(Number(req.params.id));
    if (!post) {
        return res.redirect('/blog');
    }
    res.render('blog-admin', { post });
});

/**
 * POST /blog/admin/edit/:id - 保存编辑
 */
app.post('/blog/admin/edit/:id', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.redirect('/blog');
    }
    const { title, content, summary, cover } = req.body;
    if (!title || !content) {
        const post = getPostById(Number(req.params.id));
        return res.render('blog-admin', { post, error: '标题和内容不能为空' });
    }
    updatePost(Number(req.params.id), title, content, summary, cover);
    submitIndexNow([`https://${SITE_HOST}/blog/${req.params.id}`]);
    res.redirect('/blog/' + req.params.id);
});

/**
 * POST /blog/admin/delete/:id - 删除文章（管理员）
 */
app.post('/blog/admin/delete/:id', requireLogin, (req, res) => {
    if (res.locals.user.is_admin !== 1) {
        return res.redirect('/blog');
    }
    deletePost(Number(req.params.id));
    res.redirect('/blog');
});

// ============================================================
// 评论路由
// ============================================================

/**
 * GET /blog/:id/comments - 获取评论列表
 */
app.get('/blog/:id/comments', (req, res) => {
    const postId = Number(req.params.id);
    const comments = getCommentsByPost(postId);
    res.json({ success: true, comments });
});

/**
 * POST /blog/:id/comments - 发表评论/回复
 */
app.post('/blog/:id/comments', requireLogin, (req, res) => {
    const postId = Number(req.params.id);
    const { content, parentId } = req.body;
    if (!content || !content.trim()) {
        return res.json({ success: false, error: '评论内容不能为空' });
    }
    const id = createComment(postId, res.locals.user.id, content.trim(), parentId || null);
    // 查出刚发的评论数据返回给前端
    const database = getDb();
    const comment = database.prepare(`
        SELECT c.id, c.post_id, c.user_id, c.content, c.parent_id, c.created_at,
               u.username, u.avatar
        FROM comments c LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    `).get(id);
    comment.replies = [];
    res.json({ success: true, comment });
});

/**
 * POST /blog/comment/:cid/delete - 删除评论
 */
app.post('/blog/comment/:cid/delete', requireLogin, (req, res) => {
    const commentId = Number(req.params.cid);
    const database = getDb();
    const comment = database.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
        return res.json({ success: false, error: '评论不存在' });
    }
    if (res.locals.user.is_admin !== 1 && comment.user_id !== res.locals.user.id) {
        return res.json({ success: false, error: '无权限' });
    }
    deleteComment(commentId);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log('');
    console.log('===========================================');
    console.log(`  41nb 抽卡网站已启动`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log('===========================================');
    console.log('');
});

// 优雅退出：关闭数据库连接
process.on('SIGINT', () => {
    console.log('\n[Server] 正在关闭...');
    closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
});
