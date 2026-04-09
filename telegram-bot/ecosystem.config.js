module.exports = {
  apps: [
    {
      name: "monthlykey-bot",
      script: "src/index.js",
      cwd: "/home/ubuntu/mk/telegram-bot",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/home/ubuntu/mk/telegram-bot/logs/error.log",
      out_file: "/home/ubuntu/mk/telegram-bot/logs/out.log",
      merge_logs: true,
    }
  ]
};
