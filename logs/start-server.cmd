@echo off
cd /d "D:\Mono5"
set NODE_ENV=development
npx tsx server/index.ts > "D:\Mono5\logs\server-stdout.log" 2> "D:\Mono5\logs\server-stderr.log"
