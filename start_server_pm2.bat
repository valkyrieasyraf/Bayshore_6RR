pm2 start ./dist/index.js --name 6RR -i max --update-env && pm2 save --force
pause
pm2 log --lines 500
pause
