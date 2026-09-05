const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'gacha.db'));

const rows = db.prepare("SELECT id, card_image FROM pull_history WHERE card_image != ''").all();
rows.forEach(r => {
    if (r.card_image && !r.card_image.includes('.')) {
        db.prepare("UPDATE pull_history SET card_image = ? WHERE id = ?").run(r.card_image + '.png', r.id);
        console.log('修复 ID:' + r.id + ' ' + r.card_image + ' -> ' + r.card_image + '.png');
    }
});

// 也修复 cards 表里没有后缀的
const cards = db.prepare("SELECT id, image FROM cards WHERE image != ''").all();
cards.forEach(c => {
    if (c.image && !c.image.includes('.')) {
        db.prepare("UPDATE cards SET image = ? WHERE id = ?").run(c.image + '.png', c.id);
        console.log('修复卡片 ID:' + c.id + ' ' + c.image + ' -> ' + c.image + '.png');
    }
});

console.log('修复完成');
db.close();
