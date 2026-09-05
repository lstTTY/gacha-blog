Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  41nb Gacha Server - Start" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Start nginx
$nginxService = Get-Service gacha-nginx -ErrorAction SilentlyContinue
if ($nginxService) {
    if ($nginxService.Status -ne "Running") {
        Start-Service gacha-nginx
        Write-Host "[OK] Nginx service started" -ForegroundColor Green
    } else {
        Write-Host "[OK] Nginx service already running" -ForegroundColor Green
    }
} else {
    Write-Host "[!] Nginx service not found, starting directly..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\nginx\nginx.exe" -WorkingDirectory "C:\nginx" -WindowStyle Hidden
    Write-Host "[OK] Nginx started directly" -ForegroundColor Green
}

# Start Node.js
$nodeService = Get-Service gacha-node -ErrorAction SilentlyContinue
if ($nodeService) {
    if ($nodeService.Status -ne "Running") {
        Start-Service gacha-node
        Write-Host "[OK] Node.js service started" -ForegroundColor Green
    } else {
        Write-Host "[OK] Node.js service already running" -ForegroundColor Green
    }
} else {
    Write-Host "[!] Node.js service not found, starting directly..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "server.js" -WorkingDirectory "C:\nginx\html\gacha" -WindowStyle Hidden
    Write-Host "[OK] Node.js started directly" -ForegroundColor Green
}

# Start Cloudflare Tunnel
$tunnelTask = Get-ScheduledTask -TaskName "Gacha Cloudflare Tunnel" -ErrorAction SilentlyContinue
if ($tunnelTask) {
    if ($tunnelTask.State -ne "Running") {
        Start-ScheduledTask -TaskName "Gacha Cloudflare Tunnel"
        Write-Host "[OK] Cloudflare Tunnel started" -ForegroundColor Green
    } else {
        Write-Host "[OK] Cloudflare Tunnel already running" -ForegroundColor Green
    }
} else {
    Write-Host "[!] Cloudflare Tunnel task not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  All services started!" -ForegroundColor Green
Write-Host "  https://41nb.dpdns.org" -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
