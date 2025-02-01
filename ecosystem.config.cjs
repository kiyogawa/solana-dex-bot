module.exports = {
  apps: [{
    name: 'solana-dex-bot',
    script: 'src/index.js',
    watch: false,
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    max_memory_restart: '1G',
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    time: true,
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
}
