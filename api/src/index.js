require('dotenv').config({ path: '/etc/kapbeni.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'] }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use('/uploads', express.static('/var/www/kapbeni/uploads'));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 20, message: { hata: 'Çok fazla istek' } }));
app.use('/api', rateLimit({ windowMs: 1*60*1000, max: 120 }));

// Routes — hepsi /api/* altında
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/ilanlar',    require('./routes/ilanlar-ekstra')); // overnight5: /boosted,/:id/takip,/:id/fiyat,/:id/view (VOR ilanlar.js)
app.use('/api/ilanlar',    require('./routes/ilanlar'));
app.use('/api/mesajlar',   require('./routes/mesajlar'));
app.use('/api/islemler',   require('./routes/islemler'));
app.use('/api/kategoriler',require('./routes/kategoriler'));
app.use('/api/iller',      require('./routes/iller'));
app.use('/api/bildirimler',                            require('./routes/bildirimler'));
app.use('/api/sepet',                                  require('./routes/sepet'));
app.use('/api/tickets',    require('./routes/tickets'));
app.use('/api/kyc',        require('./routes/kyc'));
app.use('/api/kuponlar',    require('./routes/kuponlar'));
app.use('/api/teklifler',   require('./routes/teklifler'));
app.use('/api/vitaminler',  require('./routes/vitaminler'));
app.use('/api/vitamin',    require('./routes/vitamin'));
app.use('/api/homepage',   require('./routes/homepage'));
app.use('/api/slider',     require('./routes/slider'));
app.use('/api/odeme',      require('./routes/odeme'));
app.use('/api/krediler',    require('./routes/krediler'));
app.use('/api/odul-avcisi', require('./routes/odul'));
app.use('/api/kazanim',     require('./routes/kazanim'));
app.use('/api/agim',        require('./routes/agim'));
app.use('/api/kayitli-aramalar',require('./routes/kayitli'));
app.use('/api/kazanc',      require('./routes/kazanc')); // overnight7: Kapbeni Kazancım
app.use('/api/geri-bildirim',require('./routes/geribildirim'));
app.use('/api/yardim',      require('./routes/yardim'));
app.use('/api/satici-dogrulama',require('./routes/dogrulama'));
app.use('/api/dogrulama',   require('./routes/hesap-dogrulama')); // overnight5: email/gsm/kyc/status
app.use('/api/favoriler',   require('./routes/favoriler'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/sikayet',       require('./routes/sikayet'));
app.use('/api/ayarlar',       require('./routes/ayarlar'));
app.use('/api/adresler',      require('./routes/adresler'));
app.use('/api/abonelik',      require('./routes/abonelik'));
app.use('/api/degerlendirme', require('./routes/degerlendirme'));
app.use('/api/destek',        require('./routes/destek'));
app.use('/api',               require('./routes/ekstra'));
app.use('/api/gsm',         require('./routes/gsm'));
app.use('/api/arama',       require('./routes/arama'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/satici',      require('./routes/satici'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/admin',       require('./routes/admin-ekstra')); // overnight5: payments,coupons,ilan-takip,geri-bildirimler

// Health check — Nginx ve Admin bu endpoint'i izler
app.get('/api/health', (req, res) => res.json({ durum: 'ok', zaman: new Date() }));

// Socket.IO — gerçek zamanlı mesajlaşma
const onlineUsers = {};
io.on('connection', (socket) => {
  socket.on('giris', (userId) => { onlineUsers[userId] = socket.id; });
  socket.on('konusma_gir', (konusmaId) => socket.join(`konusma_${konusmaId}`));
  socket.on('mesaj_gonder', (data) => io.to(`konusma_${data.konusma_id}`).emit('yeni_mesaj', data));
  socket.on('disconnect', () => {
    Object.keys(onlineUsers).forEach(k => { if (onlineUsers[k]===socket.id) delete onlineUsers[k]; });
  });
});

// 404
app.use((req, res) => res.status(404).json({ hata: 'Endpoint bulunamadı' }));

// Global error
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ hata: 'Sunucu hatası' });
});

const PORT = process.env.API_PORT || 3001;
server.listen(PORT, () => console.log(`✓ kapbeni API Port ${PORT}`));

// overnight5 Phase 1: Cron-Scheduler (Auto-Park, Boost-Dekrement, Teklif-Ablauf)
try { require('./lib/cron'); } catch (e) { console.error('[CRON] init skipped:', e.message); }

// Meilisearch: Initial-Reindex nach Start (fehlertolerant, non-fatal)
try {
  const { reindexAll } = require('./lib/meiliSync');
  setTimeout(() => reindexAll().catch(e => console.error('[Meili] reindex startup:', e.message)), 3000);
} catch (e) { console.error('[Meili] init skipped:', e.message); }
