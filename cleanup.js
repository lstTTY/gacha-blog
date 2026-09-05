const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'gacha.db'));

// 删除所有非admin用户及其历史记录
const adminUser = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (adminUser) {
    const otherUsers = db.prepare("SELECT id FROM users WHERE username != 'admin'").all();
    const otherIds = otherUsers.map(u => u.id);
    
    if (otherIds.length > 0) {
        // 删除这些用户的历史记录
        const placeholders = otherIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM pull_history WHERE user_id IN (${placeholders})`).run(...otherIds);
        db.prepare(`DELETE FROM users WHERE username != 'admin'`).run();
        console.log('已删除 ' + otherIds.length + ' 个非admin用户及其历史记录');
    } else {
        console.log('没有需要删除的用户');
    }
} else {
    console.log('admin用户不存在');
}

// 添加 email 字段
try {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT DEFAULT ""');
    console.log('已添加 email 字段');
} catch (e) { /* 已存在 */ }

// 添加 avatar 字段
try {
    db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ""');
    console.log('已添加 avatar 字段');
} catch (e) { /* 已存在 */ }

// 清除所有用户的今日次数限制（admin无限次）
db.prepare("UPDATE users SET daily_pulls = 0, last_pull_date = ''").run();
console.log('已重置所有用户每日抽卡次数');

// 验证结果
const users = db.prepare('SELECT id, username, is_admin, email, avatar FROM users').all();
console.log('\n=== 当前用户 ===');
users.forEach(u => console.log(JSON.stringify(u)));

db.close();
