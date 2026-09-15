// ==============================================================================
// WAR KONSUMSI — PM2 ECOSYSTEM CONFIGURATION
// ==============================================================================
// Usage on VPS:
//   pm2 start deploy/pm2/ecosystem.config.cjs
//   pm2 save
//   pm2 startup
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'war-konsumsi-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      exec_mode: 'fork', // Fork mode ensures single in-memory Socket.IO state
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      out_file: '../../logs/api-out.log',
      error_file: '../../logs/api-error.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'war-konsumsi-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      out_file: '../../logs/web-out.log',
      error_file: '../../logs/web-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
