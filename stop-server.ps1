Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  41nb Gacha Server - Stop" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Stop Node.js
$nodeService = Get-Service gacha-node -ErrorAction SilentlyContinue
if ($nodeService -and $nodeService.Status -eq "Running") {
    Stop-Service gacha-node -Force
    Write-Host "[OK] Node.js service stopped" -ForegroundColor Green
} else {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "[OK] Node.js process stopped" -ForegroundColor Green
}

# Stop Nginx
$nginxService = Get-Service gacha-nginx -ErrorAction SilentlyContinue
if ($nginxService -and $nginxService.Status -eq "Running") {
    Stop-Service gacha-nginx -Force
    Write-Host "[OK] Nginx service stopped" -ForegroundColor Green
} else {
    Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "[OK] Nginx process stopped" -ForegroundColor Green
}

# Stop Cloudflare Tunnel
$tunnelTask = Get-ScheduledTask -TaskName "Gacha Cloudflare Tunnel" -ErrorAction SilentlyContinue
if ($tunnelTask -and $tunnelTask.State -eq "Running") {
    Stop-ScheduledTask -TaskName "Gacha Cloudflare Tunnel"
    Write-Host "[OK] Cloudflare Tunnel stopped" -ForegroundColor Green
} else {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "[OK] Cloudflared process stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  All services stopped!" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
