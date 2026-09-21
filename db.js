/**
 * db.js - 无数据库版本（Stub）
 * 
 * 不依赖 better-sqlite3，所有数据用内存/硬编码
 * 适用于 AgentScope 沙盒等无持久化存储的环境
 */

const bcrypt = require('bcrypt');

// 硬编码卡牌数据
const SAMPLE_CARDS = [
    { id: 1, name: '青铜剑', rarity: 'R', description: '初级冒险者的标配武器，虽然普通但足够锋利', weight: 30, image: '' },
    { id: 2, name: '铁盾', rarity: 'R', description: '坚固可靠的基础防具，能挡住大部分攻击', weight: 25, image: '' },
    { id: 3, name: '疾风靴', rarity: 'R', description: '轻便的靴子，穿上后移动速度略微提升', weight: 20, image: '' },
    { id: 4, name: '治愈药水', rarity: 'R', description: '恢复少量生命值的常见药水，冒险者必备', weight: 15, image: '' },
    { id: 5, name: '寒冰刃', rarity: 'SR', description: '蕴含冰霜之力的利刃，命中时有几率冻结敌人', weight: 10, image: '' },
    { id: 6, name: '烈焰弓', rarity: 'SR', description: '射出灼热之箭的魔法弓，火焰会持续灼烧目标', weight: 8, image: '' },
    { id: 7, name: '暗影斗篷', rarity: 'SR', description: '隐匿身形的神秘披风，穿上后难以被察觉', weight: 6, image: '' },
    { id: 8, name: '雷霆权杖', rarity: 'SSR', description: '召唤雷电的上古神器，威力惊人，电闪雷鸣之间敌人灰飞烟灭', weight: 3, image: '' },
    { id: 9, name: '圣光之书', rarity: 'SSR', description: '蕴含神圣力量的典籍，能净化一切邪恶与黑暗', weight: 2, image: '' },
    { id: 10, name: '龙魂之剑', rarity: 'SSR', description: '传说中屠龙者的佩剑，剑身燃烧着永恒的龙焰', weight: 1, image: '' },
];

// 内存中的用户存储（重启丢失）
const users = [];
let nextUserId = 1;

// 模拟管理员用户
const adminUser = {
    id: 999,
    username: 'admin',
    password: '',
    pulls: 0,
    daily_pulls: 0,
    last_pull_date: '',
    created_at: new Date().toISOString(),
    is_admin: 1,
    email: '',
    avatar: '',
    banned: 0,
};

function initDatabase() {
    console.log('[DB] 无数据库模式启动，使用硬编码数据');
}

function getAllCards() {
    return SAMPLE_CARDS;
}

function getCardById(cardId) {
    return SAMPLE_CARDS.find(c => c.id === cardId) || null;
}

function getUserByUsername(username) {
    if (username === 'admin') return adminUser;
    return users.find(u => u.username === username) || null;
}

function getUserById(userId) {
    if (userId === 999) return adminUser;
    return users.find(u => u.id === userId) || null;
}

async function createUser(username, password, email) {
    if (getUserByUsername(username)) {
        return { success: false, message: '用户名已被占用' };
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const trimmedEmail = (email || '').trim();
    const qqNumber = trimmedEmail.replace('@qq.com', '');
    const avatarUrl = trimmedEmail && /@qq\.com$/i.test(trimmedEmail)
        ? 'https://q1.qlogo.cn/g?b=qq&nk=' + qqNumber + '&s=100'
        : '';

    const user = {
        id: nextUserId++,
        username,
        password: hashedPassword,
        pulls: 0,
        daily_pulls: 0,
        last_pull_date: '',
        created_at: new Date().toISOString(),
        is_admin: 0,
        email: email || '',
        avatar: avatarUrl,
        banned: 0,
    };
    users.push(user);
    return { success: true, userId: user.id };
}

async function verifyUser(username, password) {
    const user = getUserByUsername(username);
    if (!user) return { success: false, message: '用户不存在' };
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return { success: false, message: '密码错误' };
    if (user.banned === 1) return { success: false, message: '此账号已被封禁' };
    return { success: true, user };
}

function incrementPulls(userId) {
    const user = getUserById(userId);
    if (user) user.pulls = (user.pulls || 0) + 1;
}

function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const DAILY_PULL_LIMIT = 10;

function getDailyPullInfo(userId) {
    const user = getUserById(userId);
    if (!user) return { daily_pulls: 0, last_pull_date: '', remaining: DAILY_PULL_LIMIT };
    const today = getTodayString();
    if (user.last_pull_date !== today) {
        return { daily_pulls: 0, last_pull_date: user.last_pull_date, remaining: DAILY_PULL_LIMIT };
    }
    const remaining = Math.max(0, DAILY_PULL_LIMIT - user.daily_pulls);
    return { daily_pulls: user.daily_pulls, last_pull_date: user.last_pull_date, remaining };
}

function recordDailyPull(userId) {
    const user = getUserById(userId);
    if (!user) return { daily_pulls: 0, remaining: 0 };
    const today = getTodayString();
    const info = getDailyPullInfo(userId);
    if (info.remaining <= 0) return { daily_pulls: info.daily_pulls, remaining: 0 };
    if (info.last_pull_date !== today) {
        user.daily_pulls = 1;
        user.last_pull_date = today;
        return { daily_pulls: 1, remaining: DAILY_PULL_LIMIT - 1 };
    } else {
        user.daily_pulls++;
        return { daily_pulls: user.daily_pulls, remaining: DAILY_PULL_LIMIT - user.daily_pulls };
    }
}

function savePullHistory() {}
function getUserPullHistory() { return []; }
function closeDatabase() {}
function getDb() { return null; }
function getAllUsersWithStats() { return []; }
function banUser() {}
function unbanUser() {}
function getAllNews() { return []; }
function getNewsById() { return null; }
function getAllPosts() { return []; }
function getPostById() { return null; }
function incrementPostViews() {}
function countPostsByAuthor() { return 0; }
function getSiteStats() { return { totalPosts: 0, totalChars: 0, totalViews: 0 }; }
function createPost() { return 0; }
function updatePost() {}
function deletePost() {}
function getCommentsByPost() { return []; }
function createComment() { return 0; }
function deleteComment() {}

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
