/**
 * 流星特效 - canvas版
 */
(function() {
    var canvas = document.createElement('canvas');
    canvas.id = 'meteor-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;background:transparent;';
    document.documentElement.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth || document.documentElement.clientWidth;
        canvas.height = window.innerHeight || document.documentElement.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    var meteors = [];

    function createMeteor() {
        var startX = Math.random() * canvas.width * 1.5;
        meteors.push({
            x: startX,
            y: -20,
            len: Math.random() * 100 + 50,
            speed: Math.random() * 5 + 3,
            opacity: Math.random() * 0.7 + 0.2
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = meteors.length - 1; i >= 0; i--) {
            var m = meteors[i];
            m.x -= m.speed;
            m.y += m.speed;
            if (m.y > canvas.height + 50 || m.x < -50) {
                meteors.splice(i, 1);
                continue;
            }
            var tailX = m.x + m.len * 0.7;
            var tailY = m.y - m.len * 0.7;
            var gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
            gradient.addColorStop(0, 'rgba(255,255,255,0)');
            gradient.addColorStop(1, 'rgba(255,255,255,' + m.opacity + ')');
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        requestAnimationFrame(animate);
    }

    animate();
    setInterval(function() {
        if (meteors.length < 6) createMeteor();
    }, 1800);
})();
