/**
 * 批量重命名卡牌图片脚本
 * 
 * 用法：把新图片放到一个文件夹，然后运行：
 *   node rename_cards.js 你的图片文件夹路径
 * 
 * 脚本会：
 * 1. 读取数据库，找到当前最大卡牌 ID
 * 2. 按创建时间排序文件
 * 3. 从 最大ID+1 开始命名为 11.png, 12.png...（假设当前最大是10）
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

// 获取命令行参数
const folderPath = process.argv[2];

if (!folderPath) {
    console.log('用法: node rename_cards.js 图片文件夹路径');
    console.log('例如: node rename_cards.js C:\\Users\\lst\\Desktop\\新卡片');
    process.exit(1);
}

// 检查文件夹是否存在
if (!fs.existsSync(folderPath)) {
    console.log('错误: 文件夹不存在 → ' + folderPath);
    process.exit(1);
}

// 支持的图片格式
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// 获取数据库当前最大 ID
const allCards = db.getAllCards();
let maxId = 0;
for (const card of allCards) {
    if (card.id > maxId) {
        maxId = card.id;
    }
}
console.log('当前数据库最大卡牌 ID: ' + maxId);

// 读取文件夹里的图片文件
const files = fs.readdirSync(folderPath).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXTS.includes(ext);
});

if (files.length === 0) {
    console.log('文件夹里没有找到图片文件');
    process.exit(1);
}

// 按创建时间排序（旧的在前）
files.sort((a, b) => {
    const statA = fs.statSync(path.join(folderPath, a));
    const statB = fs.statSync(path.join(folderPath, b));
    return statA.birthtimeMs - statB.birthtimeMs;
});

console.log('找到 ' + files.length + ' 张图片，按创建时间排序：');
console.log('-----------------------------------');

let nextId = maxId + 1;
let count = 0;

for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const newName = nextId + ext;
    const oldPath = path.join(folderPath, file);
    const newPath = path.join(folderPath, newName);

    if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
        console.log(file + ' → ' + newName);
    } else {
        console.log(file + ' → ' + newName + ' (已经是正确名称)');
    }

    nextId++;
    count++;
}

console.log('-----------------------------------');
console.log('完成！共重命名 ' + count + ' 张图片');
console.log('文件名范围: ' + (maxId + 1) + '.xxx ~ ' + (nextId - 1) + '.xxx');
console.log('');
console.log('下一步：在 DB Browser 里添加卡牌数据，image 字段填对应的文件名（如 11.png）');
