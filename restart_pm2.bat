pm2 restart all --update-env -i max -watch "dist" && pm2 monit
pause