# 似意抽卡 - 新电脑安装指南

## 需要安装的东西
1. Node.js (https://nodejs.org/) - 下载 LTS 版本
2. nginx (http://nginx.org/en/download.html) - 下载 Windows 版本

## 部署步骤

### 1. 解压 nginx
把 nginx 解压到 `C:\nginx-1.30.4`（或其他路径）

### 2. 复制网站文件
把 `gacha-backup` 文件夹里的所有文件复制到 `C:\nginx-1.30.4\html\gacha\`

### 3. 安装依赖
打开命令行，运行：
```
cd C:\nginx-1.30.4\html\gacha
npm install
```
（如果 node_modules 已经备份好了，直接复制过去就行，不用重新 install）

### 4. 配置 nginx
把 `nginx.conf` 放到 `C:\nginx-1.30.4\conf\nginx.conf`

### 5. 启动服务
```
# 启动 nginx
cd C:\nginx-1.30.4
start nginx

# 启动 Node.js 后端
cd C:\nginx-1.30.4\html\gacha
node server.js
```

### 6. 设置开机自启（可选）
- 安装 nginx 为 Windows 服务
- 用任务计划程序设置 Node.js 自动启动

## 账号信息
- 管理员：admin / xxld2252
- 域名：41nb.dpdns.org

## 文件说明
- `server.js` - 后端主程序
- `db.js` - 数据库操作
- `gacha.db` - SQLite 数据库（用户、卡牌、抽卡记录、新闻、博客）
- `views/` - 页面模板
- `public/` - 前端资源（CSS、JS、图片）
- `public/images/cards/` - 卡牌图片（按ID命名）
- `public/images/blog/` - 博客上传的图片
- `rename_cards.js` - 批量重命名卡牌图片的脚本

## 卡牌图片命名规则
文件名就是卡牌ID，比如 `1.jpg`、`2.png`、`3.gif`
服务器启动时会自动扫描这个文件夹，把ID对应到文件名

## 注意事项
- 数据库文件 `gacha.db` 一定要备份，里面有所有用户和记录
- 卡牌图片 `public/images/cards/` 一定要备份
- 博客图片 `public/images/blog/` 如果有内容也要备份
- 流星特效是 canvas 版本，稳定可靠
