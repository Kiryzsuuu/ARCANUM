require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const connectDB = require('./db');
const Message = require('./models/Message');
const DirectMessage = require('./models/DirectMessage');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

connectDB().then(() => console.log('  DB ready'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'arcanum-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'html');
app.engine('html', require('fs').readFile.bind(require('fs')));
app.set('views', path.join(__dirname, 'views'));

const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) return next();
  res.redirect('/');
};

const authRoutes = require('./routes/auth');
const pageRoutes = require('./routes/pages');
app.use('/', authRoutes);
app.use('/', requireAuth, pageRoutes);

// ── Socket.io ────────────────────────────────────────────────
const onlineUsers = {};   // socketId -> { user, channel }
const userSockets = {};   // operatorId -> socketId  (for DM delivery)

io.on('connection', (socket) => {

  // Register operator identity (for DM routing + position tracking)
  socket.on('register', async (operatorId) => {
    userSockets[operatorId] = socket.id;
    socket.operatorId = operatorId;
    try {
      const Operator = require('./models/Operator');
      // 1. Kirim hanya operator yang ONLINE (ada di userSockets) ke client ini
      const onlineIds = Object.keys(userSockets);
      const ops = onlineIds.length
        ? await Operator.find({ active: true, lat: { $ne: null }, operatorId: { $in: onlineIds } })
            .select('operatorId name role clearance lat lng city country posUpdatedAt').lean()
        : [];
      socket.emit('positions-init', ops.map(o => ({
        id: o.operatorId, name: o.name, role: o.role, clearance: o.clearance,
        lat: o.lat, lng: o.lng, city: o.city, country: o.country,
        updatedAt: o.posUpdatedAt, status: 'online'
      })));
      // 2. Broadcast posisi operator ini ke semua client lain yang sudah ada
      const me = await Operator.findOne({ operatorId, active: true, lat: { $ne: null } })
        .select('name role clearance lat lng city country').lean();
      if (me) {
        socket.broadcast.emit('operator-position', {
          id: operatorId, name: me.name, role: me.role, clearance: me.clearance,
          lat: me.lat, lng: me.lng, city: me.city, country: me.country,
          status: 'online', updatedAt: new Date().toISOString()
        });
        // Update unit yang linked ke operator ini
        const Unit = require('./models/Unit');
        const linkedUnits = await Unit.find({ linkedOperatorId: operatorId });
        for (const unit of linkedUnits) {
          unit.lat = me.lat; unit.lng = me.lng;
          unit.grid = `${me.city || 'FIELD'}`; unit.updatedAt = new Date();
          await unit.save();
          io.emit('unit-moved', { unit: unit.unitId, name: unit.name, grid: unit.grid, lat: me.lat, lng: me.lng, time: new Date().toISOString() });
        }
      }
    } catch (_) {}
  });

  // ── Channel chat ─────────────────────────────────────────
  socket.on('join-channel', ({ channel, user }) => {
    socket.join(channel);
    onlineUsers[socket.id] = { user, channel };
    io.to(channel).emit('user-joined', { user, time: new Date().toISOString() });
  });

  socket.on('send-message', async ({ channel, user, message, burn }) => {
    const msg = {
      id: Date.now(), user, message,
      burn: burn || false,
      time: new Date().toUTCString(),
      encrypted: true
    };
    if (!burn) {
      try { await Message.create({ channel, user, message, burn: false }); } catch (_) {}
    }
    io.to(channel).emit('new-message', msg);
  });

  socket.on('update-position', ({ unit, grid, lat, lng }) => {
    io.emit('unit-moved', { unit, grid, lat, lng, time: new Date().toISOString() });
  });

  // ── Direct Messages ──────────────────────────────────────
  socket.on('dm-send', async ({ to, message, type, fileUrl, fileName, fileSize, mimeType, duration }) => {
    const from = socket.operatorId;
    if (!from) return;
    try {
      const dm = await DirectMessage.create({
        from, to,
        message: message || '',
        type: type || 'text',
        fileUrl, fileName, fileSize, mimeType, duration
      });
      const payload = {
        _id: dm._id, from, to,
        message: dm.message, type: dm.type,
        fileUrl: dm.fileUrl, fileName: dm.fileName,
        fileSize: dm.fileSize, mimeType: dm.mimeType,
        duration: dm.duration, createdAt: dm.createdAt
      };
      // Deliver to recipient
      if (userSockets[to]) {
        io.to(userSockets[to]).emit('dm-receive', payload);
      }
      // Confirm to sender
      socket.emit('dm-sent', payload);
    } catch (err) {
      console.error('DM error:', err.message);
    }
  });

  socket.on('dm-typing', ({ to }) => {
    const from = socket.operatorId;
    if (from && userSockets[to]) {
      io.to(userSockets[to]).emit('dm-typing', { from });
    }
  });

  socket.on('dm-read', async ({ from }) => {
    const me = socket.operatorId;
    if (me) {
      await DirectMessage.updateMany({ from, to: me, readAt: null }, { readAt: new Date() });
      if (userSockets[from]) {
        io.to(userSockets[from]).emit('dm-read-ack', { by: me });
      }
    }
  });

  // ── Disconnect ────────────────────────────────────────────
  socket.on('disconnect', () => {
    const data = onlineUsers[socket.id];
    if (data) {
      io.to(data.channel).emit('user-left', { user: data.user });
      delete onlineUsers[socket.id];
    }
    if (socket.operatorId) {
      delete userSockets[socket.operatorId];
      // Beritahu semua viewer grid bahwa operator ini offline
      io.emit('operator-offline', { id: socket.operatorId });
    }
  });
});

app.set('io', io);
app.set('userSockets', userSockets);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  ARCANUM SECURE COMM — http://localhost:${PORT}`);
  console.log('  Press Ctrl+C to terminate\n');
});
