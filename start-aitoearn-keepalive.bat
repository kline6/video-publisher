@echo off
:loop
cd /d "E:\gongzhonghaoxiangmu\AiToEarn-ref\project\aitoearn-backend"
set MONGODB_HOST=127.0.0.1
set MONGODB_PORT=27017
set REDIS_HOST=127.0.0.1
set REDIS_PORT=6379
set REDIS_PASSWORD=
set JWT_SECRET=dev-jwt-secret-changeme
set INTERNAL_TOKEN=dev-internal-token-changeme
set NODE_ENV=development
set APP_DOMAIN=localhost
set AI_URL=http://127.0.0.1:3010
echo [%date% %time%] Starting VideoFlow server... >> "E:\gongzhonghaoxiangmu\backend-keepalive.log"
npx nx serve aitoearn-server >> "E:\gongzhonghaoxiangmu\backend-keepalive.log" 2>&1
echo [%date% %time%] Exited with code %errorlevel%, restarting... >> "E:\gongzhonghaoxiangmu\backend-keepalive.log"
timeout /t 3 /nobreak >nul
goto loop
