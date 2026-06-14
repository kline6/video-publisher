# Start both backend and frontend as child processes
$backendDir = "E:\gongzhonghaoxiangmu\project\backend"
$frontendDir = "E:\gongzhonghaoxiangmu\project\frontend"

Write-Host "Starting backend..."
$backendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$backendDir`" && node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts" -PassThru -NoNewWindow

Write-Host "Backend PID: $($backendProc.Id)"
Write-Host "Waiting for backend to initialize..."
Start-Sleep -Seconds 12

Write-Host "Starting frontend..."
$frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$frontendDir`" && node node_modules/vite/bin/vite.js --host" -PassThru -NoNewWindow

Write-Host "Frontend PID: $($frontendProc.Id)"
Write-Host ""
Write-Host "========================================="
Write-Host "  VideoFlow is running!"
Write-Host "  Backend:  http://localhost:3000"
Write-Host "  Frontend: http://localhost:5173"
Write-Host "========================================="
Write-Host ""
Write-Host "Press Ctrl+C to stop both services..."
Write-Host ""

# Wait for either process to exit
try {
    while (-not $backendProc.HasExited -and -not $frontendProc.HasExited) {
        Start-Sleep -Seconds 2
    }
} finally {
    if (-not $backendProc.HasExited) { $backendProc.Kill() }
    if (-not $frontendProc.HasExited) { $frontendProc.Kill() }
    Write-Host "Both services stopped."
}
