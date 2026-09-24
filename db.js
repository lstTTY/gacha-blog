/**
 * db.js - SQLite 数据库模块
 * 
 * 负责：
 * 1. 连接 SQLite 数据库
 * 2. 创建 cards 表和 users 表
 * 3. 如果 cards 表为空，插入 10 张示例卡牌
 * 4. 导出数据库操作函数供其他文件使用
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

// 数据库文件路径（和本文件放在同一目录下）
const DB_PATH = path.join(__dirname, 'gacha.db');

// 数据库实例（单例模式，整个应用共用一个连接）
let db = null;

/**
 * 获取数据库连接
 * 如果还没创建过连接，就新建一个；否则返回已有的
 */
function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        // 开启 WAL 模式，提升并发读写性能
        db.pragma('journal_mode = WAL');
        // 锁冲突时最多等待 5 秒，避免偶发 SQLITE_BUSY 报错
        db.pragma('busy_timeout = 5000');
    }
    return db;
}

/**
 * 初始化数据库
 * 创建表结构 + 插入示例卡牌数据（仅在表为空时插入）
 */
function initDatabase() {
    const database = getDb();

    // ---- 创建 cards 表 ----
    database.exec(`
        CREATE TABLE IF NOT EXISTS cards (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            rarity      TEXT    NOT NULL,
            description TEXT    DEFAULT '',
            weight      INTEGER DEFAULT 1,
            image       TEXT    DEFAULT ''
        )
    `);

    // ---- 创建 users 表 ----
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    UNIQUE NOT NULL,
            password        TEXT    NOT NULL,
            pulls           INTEGER DEFAULT 0,
            daily_pulls     INTEGER DEFAULT 0,
            last_pull_date  TEXT    DEFAULT '',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ---- 兼容旧数据库：如果字段不存在就加上 ----
    try {
        database.exec('ALTER TABLE users ADD COLUMN daily_pulls INTEGER DEFAULT 0');
        console.log('[DB] 已给 users 表添加 daily_pulls 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE users ADD COLUMN last_pull_date TEXT DEFAULT ""');
        console.log('[DB] 已给 users 表添加 last_pull_date 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
        console.log('[DB] 已给 users 表添加 is_admin 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE users ADD COLUMN email TEXT DEFAULT ""');
        console.log('[DB] 已给 users 表添加 email 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ""');
        console.log('[DB] 已给 users 表添加 avatar 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0');
        console.log('[DB] 已给 users 表添加 banned 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE cards ADD COLUMN image TEXT DEFAULT ""');
        console.log('[DB] 已给 cards 表添加 image 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }

    // ---- 兼容旧 pull_history 表：加 card_description 和 card_image ----
    try {
        database.exec('ALTER TABLE pull_history ADD COLUMN card_description TEXT DEFAULT ""');
        console.log('[DB] 已给 pull_history 表添加 card_description 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }
    try {
        database.exec('ALTER TABLE pull_history ADD COLUMN card_image TEXT DEFAULT ""');
        console.log('[DB] 已给 pull_history 表添加 card_image 字段');
    } catch (e) {
        // 字段已存在，忽略错误
    }

    // ---- 创建 pull_history 抽卡历史表 ----
    database.exec(`
        CREATE TABLE IF NOT EXISTS pull_history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            card_name       TEXT    NOT NULL,
            card_rarity     TEXT    NOT NULL,
            card_description TEXT   DEFAULT '',
            card_image      TEXT    DEFAULT '',
            pulled_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // ---- 创建博客文章表 ----
    database.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT    NOT NULL,
            content     TEXT    NOT NULL DEFAULT '',
            summary     TEXT    DEFAULT '',
            cover       TEXT    DEFAULT '',
            author      TEXT    DEFAULT '',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // ---- posts 表新增 views 浏览量字段（老库兼容） ----
    try {
        database.prepare('ALTER TABLE posts ADD COLUMN views INTEGER DEFAULT 0').run();
        console.log('[DB] posts 表已添加 views 字段');
    } catch (e) { /* 已存在则忽略 */ }

    // ---- 创建评论表 ----
    database.exec(`
        CREATE TABLE IF NOT EXISTS comments (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id    INTEGER NOT NULL,
            user_id    INTEGER NOT NULL,
            content    TEXT    NOT NULL,
            parent_id  INTEGER DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
        )
    `);

    // ---- 如果 cards 表为空，插入示例卡牌 ----
    const cardCount = database.prepare('SELECT COUNT(*) as count FROM cards').get();
    
    if (cardCount.count === 0) {
        console.log('[DB] cards 表为空，正在插入示例卡牌数据...');
        insertSampleCards(database);
        console.log('[DB] 示例卡牌插入完成！');
    } else {
        console.log(`[DB] cards 表已有 ${cardCount.count} 张卡牌，跳过插入`);
    }
}

/**
 * 插入 10 张示例卡牌
 * 概率设计：SSR 约 6%，SR 约 24%，R 约 70%
 */
function insertSampleCards(database) {
    const sampleCards = [
        // R 级卡牌（普通）
        { name: '青铜剑', rarity: 'R', description: '初级冒险者的标配武器，虽然普通但足够锋利', weight: 30 },
        { name: '铁盾', rarity: 'R', description: '坚固可靠的基础防具，能挡住大部分攻击', weight: 25 },
        { name: '疾风靴', rarity: 'R', description: '轻便的靴子，穿上后移动速度略微提升', weight: 20 },
        { name: '治愈药水', rarity: 'R', description: '恢复少量生命值的常见药水，冒险者必备', weight: 15 },

        // SR 级卡牌（稀有）
        { name: '寒冰刃', rarity: 'SR', description: '蕴含冰霜之力的利刃，命中时有几率冻结敌人', weight: 10 },
        { name: '烈焰弓', rarity: 'SR', description: '射出灼热之箭的魔法弓，火焰会持续灼烧目标', weight: 8 },
        { name: '暗影斗篷', rarity: 'SR', description: '隐匿身形的神秘披风，穿上后难以被察觉', weight: 6 },

        // SSR 级卡牌（传说）
        { name: '雷霆权杖', rarity: 'SSR', description: '召唤雷电的上古神器，威力惊人，电闪雷鸣之间敌人灰飞烟灭', weight: 3 },
        { name: '圣光之书', rarity: 'SSR', description: '蕴含神圣力量的典籍，能净化一切邪恶与黑暗', weight: 2 },
        { name: '龙魂之剑', rarity: 'SSR', description: '传说中屠龙者的佩剑，剑身燃烧着永恒的龙焰', weight: 1 },
    ];

    // 预编译插入语句（性能更好）
    const insertCard = database.prepare(
        'INSERT INTO cards (name, rarity, description, weight) VALUES (?, ?, ?, ?)'
    );

    // 使用事务批量插入（要么全部成功，要么全部失败）
    const insertMany = database.transaction((cards) => {
        for (const card of cards) {
            insertCard.run(card.name, card.rarity, card.description, card.weight);
        }
    });

    insertMany(sampleCards);
}

/**
 * 获取所有卡牌（用于抽卡计算）
 */
function getAllCards() {
    const database = getDb();
    return database.prepare('SELECT * FROM cards').all();
}

/**
 * 根据用户名查找用户
 */
function getUserByUsername(username) {
    const database = getDb();
    return database.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

/**
 * 根据用户 ID 查找用户
 */
function getUserById(userId) {
    const database = getDb();
    return database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/**
 * 创建新用户
 * 返回 { success: true } 或 { success: false, message: '错误信息' }
 */
async function createUser(username, password, email) {
    const database = getDb();

    // 检查用户名是否已存在
    const existingUser = getUserByUsername(username);
    if (existingUser) {
        return { success: false, message: '用户名已被占用' };
    }

    // 密码哈希（10 轮 salt）
    const hashedPassword = await bcrypt.hash(password, 10);

    // 仅 QQ 邮箱生成 QQ 头像地址（100x100），其他邮箱不设置头像
    const trimmedEmail = (email || '').trim();
    const qqNumber = trimmedEmail.replace('@qq.com', '');
    const avatarUrl = trimmedEmail && /@qq\.com$/i.test(trimmedEmail)
        ? 'https://q1.qlogo.cn/g?b=qq&nk=' + qqNumber + '&s=100'
        : '';

    // 插入新用户
    const result = database.prepare(
        'INSERT INTO users (username, password, email, avatar) VALUES (?, ?, ?, ?)'
    ).run(username, hashedPassword, email || '', avatarUrl);

    return { success: true, userId: result.lastInsertRowid };
}

/**
 * 验证用户登录
 * 返回 { success: true, user } 或 { success: false, message: '错误信息' }
 */
async function verifyUser(username, password) {
    const database = getDb();

    // 查找用户
    const user = getUserByUsername(username);
    if (!user) {
        return { success: false, message: '用户不存在' };
    }

    // 比对密码
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return { success: false, message: '密码错误' };
    }

    // 检查是否被封号
    if (user.banned === 1) {
        return { success: false, message: '此账号已被封禁' };
    }

    return { success: true, user };
}

/**
 * 用户抽卡次数 +1
 */
function incrementPulls(userId) {
    const database = getDb();
    database.prepare('UPDATE users SET pulls = pulls + 1 WHERE id = ?').run(userId);
}

/**
 * 获取今天的日期字符串（格式：YYYY-MM-DD）
 */
function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 每日抽卡上限
const DAILY_PULL_LIMIT = 10;

/**
 * 获取用户今日抽卡信息
 * 返回 { daily_pulls, last_pull_date, remaining }
 */
function getDailyPullInfo(userId) {
    const database = getDb();
    const user = database.prepare(
        'SELECT daily_pulls, last_pull_date FROM users WHERE id = ?'
    ).get(userId);

    if (!user) {
        return { daily_pulls: 0, last_pull_date: '', remaining: DAILY_PULL_LIMIT };
    }

    const today = getTodayString();

    // 如果上次抽卡日期不是今天，说明是新的一天，次数重置
    if (user.last_pull_date !== today) {
        return { daily_pulls: 0, last_pull_date: user.last_pull_date, remaining: DAILY_PULL_LIMIT };
    }

    // 还是今天，计算剩余次数
    const remaining = Math.max(0, DAILY_PULL_LIMIT - user.daily_pulls);
    return { daily_pulls: user.daily_pulls, last_pull_date: user.last_pull_date, remaining };
}

/**
 * 记录一次抽卡（每日次数 +1，更新日期）
 * 返回更新后的 { daily_pulls, remaining }
 */
function recordDailyPull(userId) {
    const database = getDb();
    const today = getTodayString();
    const info = getDailyPullInfo(userId);

    if (info.remaining <= 0) {
        return { daily_pulls: info.daily_pulls, remaining: 0 };
    }

    // 如果是新的一天，重置计数；否则 +1
    if (info.last_pull_date !== today) {
        database.prepare(
            'UPDATE users SET daily_pulls = 1, last_pull_date = ? WHERE id = ?'
        ).run(today, userId);
        return { daily_pulls: 1, remaining: DAILY_PULL_LIMIT - 1 };
    } else {
        database.prepare(
            'UPDATE users SET daily_pulls = daily_pulls + 1 WHERE id = ?'
        ).run(userId);
        return { daily_pulls: info.daily_pulls + 1, remaining: DAILY_PULL_LIMIT - info.daily_pulls - 1 };
    }
}

/**
 * 根据卡牌 ID 获取卡牌
 */
function getCardById(cardId) {
    const database = getDb();
    return database.prepare('SELECT * FROM cards WHERE id = ?').get(cardId);
}

/**
 * 保存一条抽卡记录到历史
 */
function savePullHistory(userId, cardName, cardRarity, cardDescription, cardImage) {
    const database = getDb();
    database.prepare(
        'INSERT INTO pull_history (user_id, card_name, card_rarity, card_description, card_image) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, cardName, cardRarity, cardDescription || '', cardImage || '');
}

/**
 * 获取用户的抽卡历史（按时间倒序，最新的在前面）
 */
function getUserPullHistory(userId) {
    const database = getDb();
    return database.prepare(
        'SELECT * FROM pull_history WHERE user_id = ? ORDER BY pulled_at DESC'
    ).all(userId);
}

/**
 * 关闭数据库连接（应用退出时调用）
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

// ================================================================
// 管理员功能
// ================================================================

/**
 * 获取所有用户及其抽卡统计
 */
function getAllUsersWithStats() {
    const database = getDb();
    const users = database.prepare(`
        SELECT u.id, u.username, u.email, u.avatar, u.is_admin, u.banned, u.created_at,
               COUNT(ph.id) as total_pulls
        FROM users u
        LEFT JOIN pull_history ph ON u.id = ph.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();
    return users;
}

/**
 * 封号
 */
function banUser(userId) {
    const database = getDb();
    database.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(userId);
}

/**
 * 解封
 */
function unbanUser(userId) {
    const database = getDb();
    database.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(userId);
}

/**
 * 获取指定用户的抽卡记录
 */
function getUserPullHistory(userId) {
    const database = getDb();
    return database.prepare(
        'SELECT * FROM pull_history WHERE user_id = ? ORDER BY pulled_at DESC'
    ).all(userId);
}

/**
 * 获取所有公告（按时间倒序）
 */
function getAllNews() {
    const database = getDb();
    return database.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
}

/**
 * 获取单条公告
 */
function getNewsById(id) {
    const database = getDb();
    return database.prepare('SELECT * FROM news WHERE id = ?').get(id);
}

// ---- 博客文章 CRUD ----

/**
 * 获取所有文章（按时间倒序）
 */
function getAllPosts() {
    const database = getDb();
    return database.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
}

/**
 * 获取单篇文章
 */
function getPostById(id) {
    const database = getDb();
    return database.prepare('SELECT * FROM posts WHERE id = ?').get(id);
}

/**
 * 浏览量 +1
 */
function incrementPostViews(id) {
    const database = getDb();
    database.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(id);
}

/**
 * 统计某作者发布的文章总数
 */
function countPostsByAuthor(author) {
    const database = getDb();
    return database.prepare('SELECT COUNT(*) AS c FROM posts WHERE author = ?').get(author).c;
}

/**
 * 全站统计
 */
function getSiteStats() {
    const database = getDb();
    const row = database.prepare('SELECT COUNT(*) AS totalPosts, COALESCE(SUM(LENGTH(content)), 0) AS totalChars, COALESCE(SUM(views), 0) AS totalViews FROM posts').get();
    return {
        totalPosts: row.totalPosts || 0,
        totalChars: row.totalChars || 0,
        totalViews: row.totalViews || 0,
    };
}

/**
 * 新建文章
 */
function createPost(title, content, summary, cover, author) {
    const database = getDb();
    const stmt = database.prepare(
        'INSERT INTO posts (title, content, summary, cover, author) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(title, content, summary || '', cover || '', author || '');
    return result.lastInsertRowid;
}

/**
 * 更新文章
 */
function updatePost(id, title, content, summary, cover) {
    const database = getDb();
    database.prepare(
        'UPDATE posts SET title = ?, content = ?, summary = ?, cover = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(title, content, summary || '', cover || '', id);
}

/**
 * 删除文章
 */
function deletePost(id) {
    const database = getDb();
    database.prepare('DELETE FROM posts WHERE id = ?').run(id);
}

// ---- 评论 CRUD ----

/**
 * 获取文章的所有评论（含嵌套回复）
 */
function getCommentsByPost(postId) {
    const database = getDb();
    const all = database.prepare(`
        SELECT c.id, c.post_id, c.user_id, c.content, c.parent_id, c.created_at,
               u.username, u.avatar
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `).all(postId);

    // 构建嵌套结构
    const map = new Map();
    const roots = [];
    all.forEach(c => { c.replies = []; map.set(c.id, c); });
    all.forEach(c => {
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id).replies.push(c);
        } else {
            roots.push(c);
        }
    });
    return roots;
}

/**
 * 发表评论
 */
function createComment(postId, userId, content, parentId) {
    const database = getDb();
    const result = database.prepare(
        'INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)'
    ).run(postId, userId, content, parentId || null);
    return result.lastInsertRowid;
}

/**
 * 删除评论
 */
function deleteComment(commentId) {
    const database = getDb();
    database.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
}

// 导出所有函数
module.exports = {
    initDatabase,
    getAllCards,
    getCardById,
    getUserByUsername,
    getUserById,
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
};
