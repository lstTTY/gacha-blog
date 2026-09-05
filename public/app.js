/**
 * app.js - 前端抽卡逻辑 + 粒子特效
 */

const RARITY_ICONS = { 'N': '🪨', 'R': '⚔️', 'SR': '🗡️', 'SSR': '👑', 'SSSR': '🔥' };
const RARITY_NAMES = { 'N': '普通', 'R': '精良', 'SR': '稀有', 'SSR': '传说', 'SSSR': '超凡' };


// ================================================================
// 粒子特效系统
// ================================================================

var particleCanvas, particleCtx;
var particles = [];
var particleAnimating = false;
var particlePhase = ''; // 'converge' 或 'burst'
var particleCallback = null;
var particleColor = '#809f9f';

/**
 * 初始化 canvas
 */
function initParticleCanvas() {
    particleCanvas = document.getElementById('particleCanvas');
    if (!particleCanvas) return;
    particleCtx = particleCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    if (!particleCanvas) return;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}

/**
 * 创建单个粒子
 */
function createParticle(targetX, targetY, phase) {
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var angle = Math.random() * Math.PI * 2;
    var dist = Math.random() * 300 + 100;

    if (phase === 'converge') {
        // 从四周向中心收缩
        return {
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            targetX: cx,
            targetY: cy,
            size: Math.random() * 3 + 1.5,
            speed: Math.random() * 0.035 + 0.025,
            progress: 0,
            alpha: 1,
            color: particleColor,
        };
    } else {
        // 从中心向外爆发
        var burstAngle = Math.random() * Math.PI * 2;
        var burstDist = Math.random() * 400 + 150;
        return {
            x: cx,
            y: cy,
            targetX: cx + Math.cos(burstAngle) * burstDist,
            targetY: cy + Math.sin(burstAngle) * burstDist,
            size: Math.random() * 4 + 2,
            speed: Math.random() * 0.03 + 0.02,
            progress: 0,
            alpha: 1,
            color: particleColor,
        };
    }
}

/**
 * 启动粒子动画
 */
function startParticles(color, callback) {
    particleColor = color || '#809f9f';
    particleCallback = callback;
    particleAnimating = true;
    particles = [];

    particleCanvas.style.display = 'block';
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    // 生成粒子，收缩阶段
    particlePhase = 'converge';
    for (var i = 0; i < 80; i++) {
        particles.push(createParticle(0, 0, 'converge'));
    }

    animateParticles();
}

/**
 * 粒子动画主循环
 */
function animateParticles() {
    if (!particleAnimating) return;

    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    var allDone = true;

    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.progress += p.speed;

        if (p.progress >= 1) p.progress = 1;
        else allDone = false;

        // 缓动函数： easeInOutCubic
        var t = p.progress;
        var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        var currentX = p.x + (p.targetX - p.x) * ease;
        var currentY = p.y + (p.targetY - p.y) * ease;

        // 爆发阶段：边扩散边消失
        var fadeAlpha = particlePhase === 'burst' ? (1 - p.progress) : 1;

        // 绘制粒子
        particleCtx.beginPath();
        particleCtx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
        particleCtx.fillStyle = p.color;
        particleCtx.globalAlpha = p.alpha * fadeAlpha * (1 - p.progress * 0.3);
        particleCtx.fill();

        // 发光效果
        particleCtx.beginPath();
        particleCtx.arc(currentX, currentY, p.size * 2.5, 0, Math.PI * 2);
        particleCtx.fillStyle = p.color;
        particleCtx.globalAlpha = p.alpha * 0.15 * fadeAlpha * (1 - p.progress);
        particleCtx.fill();
    }

    particleCtx.globalAlpha = 1;

    if (allDone && particlePhase === 'converge') {
        // 收缩完成，切换到爆发阶段，同时立即显示卡牌
        particlePhase = 'burst';
        particles = [];
        for (var j = 0; j < 120; j++) {
            particles.push(createParticle(0, 0, 'burst'));
        }
        // 闪白效果
        flashCenter();
        // 卡牌与爆发同时出现
        if (particleCallback) {
            particleCallback();
            particleCallback = null;
        }
    } else if (allDone && particlePhase === 'burst') {
        // 爆发粒子消散，结束动画
        particleAnimating = false;
        particleCanvas.style.display = 'none';
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        return;
    }

    requestAnimationFrame(animateParticles);
}

/**
 * 中心闪光效果
 */
function flashCenter() {
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var flashAlpha = 0.8;
    var flashSize = 20;

    function drawFlash() {
        if (flashAlpha <= 0) return;

        particleCtx.beginPath();
        particleCtx.arc(cx, cy, flashSize, 0, Math.PI * 2);
        particleCtx.fillStyle = '#ffffff';
        particleCtx.globalAlpha = flashAlpha;
        particleCtx.fill();

        // 外圈光晕
        particleCtx.beginPath();
        particleCtx.arc(cx, cy, flashSize * 3, 0, Math.PI * 2);
        particleCtx.fillStyle = particleColor;
        particleCtx.globalAlpha = flashAlpha * 0.3;
        particleCtx.fill();

        particleCtx.globalAlpha = 1;

        flashAlpha -= 0.05;
        flashSize += 8;
        requestAnimationFrame(drawFlash);
    }
    drawFlash();
}


// ================================================================
// 抽卡逻辑
// ================================================================

/**
 * 执行抽卡
 */
async function drawCard() {
    var btn = document.getElementById('drawBtn');
    var pullCount = document.getElementById('pullCount');

    // 管理员：获取指定卡牌ID
    var cardId = null;
    if (typeof IS_ADMIN !== 'undefined' && IS_ADMIN) {
        var input = document.getElementById('adminCardId');
        if (input && input.value.trim() !== '') {
            cardId = parseInt(input.value.trim());
            if (isNaN(cardId) || cardId < 1) {
                alert('请输入有效的卡牌ID');
                return;
            }
        }
    }

    // 禁用按钮
    btn.disabled = true;
    btn.textContent = '抽取中...';

    try {
        var body = {};
        if (cardId) body.cardId = cardId;

        const response = await fetch('/api/draw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await response.json();

        if (data.success) {
            // 启动粒子特效，特效结束后再显示结果
            startParticles(data.card.color, function() {
                showResult(data.card);

                if (data.pulls !== undefined && pullCount) {
                    pullCount.textContent = data.pulls;
                }

                // 无限抽卡模式：次数固定显示"不限"，按钮永不禁用
                if (typeof IS_UNLIMITED !== 'undefined' && IS_UNLIMITED) {
                    var rc = document.getElementById('remainingCount');
                    if (rc) rc.textContent = '不限';
                    btn.disabled = false;
                    btn.textContent = '抽 一 次';
                    return;
                }

                // 非管理员更新剩余次数
                if (!data.isAdmin) {
                    var remainingCount = document.getElementById('remainingCount');
                    if (data.remaining !== undefined && remainingCount) {
                        remainingCount.textContent = data.remaining;
                    }
                    if (data.remaining !== undefined && data.remaining <= 0) {
                        btn.disabled = true;
                        btn.textContent = '今日次数已用完';
                    } else {
                        btn.disabled = false;
                        btn.textContent = '抽 一 次';
                    }
                } else {
                    btn.disabled = false;
                    btn.textContent = '抽 一 次';
                }
            });

        } else {
            alert(data.error || '抽卡失败');
            btn.disabled = false;
            btn.textContent = '抽 一 次';
        }

    } catch (error) {
        console.error('抽卡请求失败:', error);
        alert('网络错误，请检查连接后重试');
        btn.disabled = false;
        btn.textContent = '抽 一 次';
    }
}


/**
 * 弹窗显示抽卡结果
 */
function showResult(card) {
    var overlay = document.getElementById('resultOverlay');
    var image = document.getElementById('resultCardImage');
    var name = document.getElementById('resultCardName');
    var rarity = document.getElementById('resultCardRarity');
    var desc = document.getElementById('resultCardDesc');

    if (card.image) {
        image.className = 'result-card-image';
        image.innerHTML = '<img src="/images/cards/' + card.image + '" onerror="this.parentElement.className=\'result-card-image rarity-' + card.rarity + '\';this.parentElement.innerHTML=RARITY_ICONS[\'' + card.rarity + '\']||\'?\';" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
    } else {
        image.className = 'result-card-image rarity-' + card.rarity;
        image.innerHTML = RARITY_ICONS[card.rarity] || '?';
    }

    name.textContent = card.name;
    name.style.color = card.color;

    var label = card.rarity + ' · ' + (RARITY_NAMES[card.rarity] || '');
    rarity.textContent = label;
    rarity.style.background = card.color + '33';
    rarity.style.color = card.color;
    rarity.style.border = '1px solid ' + card.color;

    desc.textContent = card.description;

    overlay.style.display = 'flex';
}


function closeResult() {
    document.getElementById('resultOverlay').style.display = 'none';
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'resultOverlay') {
        closeResult();
    }
});

// 页面加载时初始化 canvas
initParticleCanvas();
