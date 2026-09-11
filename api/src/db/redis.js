const { createClient } = require('redis');
require('dotenv').config({ path: '/etc/kapbeni.env' });

const client = createClient({ url: process.env.REDIS_URL });
client.on('error', e => console.error('Redis error:', e));
client.connect().then(() => console.log('✓ Redis bağlandı'));

module.exports = client;
