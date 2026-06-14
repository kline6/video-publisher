@echo off
cd /d "E:\gongzhonghaoxiangmu\AiToEarn-ref\project\aitoearn-backend"
set MONGODB_HOST=127.0.0.1
set MONGODB_PORT=27017
set REDIS_HOST=127.0.0.1
set REDIS_PORT=6379
set REDIS_PASSWORD=password
set JWT_SECRET=dev-jwt-secret-changeme
set INTERNAL_TOKEN=dev-internal-token-changeme
set NODE_ENV=development
set APP_DOMAIN=localhost
set ASSETS_CONFIG={"provider":"local","uploadDir":"./uploads"}
set AI_URL=http://127.0.0.1:3010
npx nx serve aitoearn-server
