/**
 * effects.js - 星空粒子 + 樱花飘落特效
 * 
 * 使用方法：在页面底部引入 <script src="/effects.js?v=4"></script>
 * 
 * 包含：
 * 1. 星空粒子层 - canvas 绘制，随机闪烁的星星
 * 2. 樱花飘落层 - canvas 绘制，粉红色花瓣缓缓飘落
 */

;(function () {
    'use strict';

    /* ================================================================
       1. 星空粒子层
       ================================================================ */

    function initStarfield() {
        var canvas = document.createElement('canvas');
        canvas.className = 'starfield-canvas';
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');

        var stars = [];
        var STAR_COUNT = 120;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        function createStars() {
            stars = [];
            for (var i = 0; i < STAR_COUNT; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    r: Math.random() * 1.5 + 0.5,
                    alpha: Math.random(),
                    alphaDir: (Math.random() - 0.5) * 0.015
                });
            }
        }

        function drawStars() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                // 闪烁
                s.alpha += s.alphaDir;
                if (s.alpha >= 1 || s.alpha <= 0.1) s.alphaDir = -s.alphaDir;
                s.alpha = Math.max(0.1, Math.min(1, s.alpha));

                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,240,' + s.alpha + ')';
                ctx.fill();
            }
        }

        function loop() {
            drawStars();
            requestAnimationFrame(loop);
        }

        resize();
        createStars();
        window.addEventListener('resize', function () {
            resize();
            createStars();
        });
        loop();
    }

    /* ================================================================
       2. 樱花飘落层
       ================================================================ */

    function initSakura() {
        var canvas = document.createElement('canvas');
        canvas.className = 'sakura-canvas';
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d');

        var petals = [];
        var PETAL_COUNT = 50;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        /**
         * 创建一片樱花瓣
         * @param {boolean} randomY - 是否随机起始 Y（首次创建用）
         */
        function createPetal(randomY) {
            var size = Math.random() * 10 + 8; // 8 ~ 18 px
            return {
                x: Math.random() * canvas.width,
                y: randomY ? Math.random() * canvas.height : -size,
                size: size,
                speedY: Math.random() * 1.2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.8,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.04,
                alpha: Math.random() * 0.5 + 0.5
            };
        }

        function createPetals() {
            petals = [];
            for (var i = 0; i < PETAL_COUNT; i++) {
                petals.push(createPetal(true));
            }
        }

        /**
         * 画一片樱花瓣（椭圆 + 渐变）
         */
        function drawPetal(p) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.alpha;

            // 花瓣渐变
            var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
            grad.addColorStop(0, 'rgba(255,183,197,0.9)');
            grad.addColorStop(1, 'rgba(255,192,203,0.3)');

            ctx.beginPath();
            ctx.ellipse(0, 0, p.size * 0.6, p.size, 0, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // 花瓣中线
            ctx.beginPath();
            ctx.moveTo(0, -p.size * 0.8);
            ctx.lineTo(0, p.size * 0.8);
            ctx.strokeStyle = 'rgba(255,150,170,0.3)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            ctx.restore();
        }

        function update() {
            for (var i = 0; i < petals.length; i++) {
                var p = petals[i];
                p.y += p.speedY;
                p.x += p.speedX + Math.sin(p.y * 0.01) * 0.3; // 微风摆动
                p.rotation += p.rotSpeed;

                // 超出屏幕则重置到顶部
                if (p.y > canvas.height + p.size) {
                    petals[i] = createPetal(false);
                }
            }
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (var i = 0; i < petals.length; i++) {
                drawPetal(petals[i]);
            }
        }

        function loop() {
            update();
            draw();
            requestAnimationFrame(loop);
        }

        resize();
        createPetals();
        window.addEventListener('resize', function () {
            resize();
        });
        loop();
    }

    /* ================================================================
       启动
       ================================================================ */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initStarfield();
            initSakura();
        });
    } else {
        initStarfield();
        initSakura();
    }

})();
