module.exports = {
  apps: [
    {
      name: 'kapbeni-api',
      script: '/opt/kapbeni/api/src/index.js',
      cwd: '/opt/kapbeni/api',
      instances: 1,
      env_file: '/etc/kapbeni.env',
      error_file: '/var/log/kapbeni/api-error.log',
      out_file: '/var/log/kapbeni/api-out.log',
      max_memory_restart: '512M',
    },
    {
      name: 'kapbeni-admin',
      script: '/opt/kapbeni/admin/server.js',
      cwd: '/opt/kapbeni/admin',
      env_file: '/etc/kapbeni.env',
      error_file: '/var/log/kapbeni/admin-error.log',
      out_file: '/var/log/kapbeni/admin-out.log',
    },
    {
      // Medya Motoru (Auftragssammlung J, v1.28): Videos + Bestandsbilder,
      // nur 127.0.0.1:3901, hoechstens 2 ffmpeg gleichzeitig.
      name: 'kapbeni-media',
      script: '/opt/kapbeni/api/src/medyaMotoru.js',
      cwd: '/opt/kapbeni/api',
      instances: 1,
      env_file: '/etc/kapbeni.env',
      error_file: '/var/log/kapbeni/media-error.log',
      out_file: '/var/log/kapbeni/media-out.log',
      max_memory_restart: '700M',
      kill_timeout: 5000,
    },
    {
      name: 'kapbeni-kyc',
      script: '/opt/kapbeni/kyc/venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8001 --workers 1',
      cwd: '/opt/kapbeni/kyc',
      interpreter: 'none',
      error_file: '/var/log/kapbeni/kyc-error.log',
      out_file: '/var/log/kapbeni/kyc-out.log',
    },
  ],
};
