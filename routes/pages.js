const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const Channel       = require('../models/Channel');
const Sitrep        = require('../models/Sitrep');
const Unit          = require('../models/Unit');
const Operator      = require('../models/Operator');
const Message       = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');
const InviteCode    = require('../models/InviteCode');

// ── Multer setup ──────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/dm');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname) || '';
    cb(null, unique + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100 MB

const sendView = (res, file) => res.sendFile(path.join(__dirname, `../views/${file}`));

// ── Page routes ───────────────────────────────────────────────
router.get('/dashboard', (req, res) => sendView(res, 'dashboard.html'));

router.get('/channels',  (req, res) => sendView(res, 'channels.html'));
router.get('/channels/:id', (req, res) => sendView(res, 'channels.html'));
router.get('/sitrep',    (req, res) => sendView(res, 'sitrep.html'));
router.get('/grid',      (req, res) => sendView(res, 'grid.html'));
router.get('/operators', (req, res) => sendView(res, 'operators.html'));
router.get('/dm',        (req, res) => sendView(res, 'dm.html'));
router.get('/dm/:userId',(req, res) => sendView(res, 'dm.html'));

// ── API: me ───────────────────────────────────────────────────
router.get('/api/me', (req, res) => res.json(req.session.user));

// PUT /api/me — user edit profile sendiri
router.put('/api/me', async (req, res) => {
  const me = req.session.user.id;
  const { name, email, passphrase, newPassphrase } = req.body;
  try {
    const op = await Operator.findOne({ operatorId: me });
    if (!op) return res.status(404).json({ error: 'Not found' });

    // Verify current passphrase before allowing changes
    if (passphrase) {
      const valid = await op.verifyPassphrase(passphrase);
      if (!valid) return res.status(401).json({ error: 'Passphrase saat ini salah' });
    } else {
      return res.status(400).json({ error: 'Masukkan passphrase saat ini untuk konfirmasi' });
    }

    if (name && name.trim()) op.name = name.trim().toUpperCase();
    if (email !== undefined) op.email = email.trim().toLowerCase();
    if (newPassphrase && newPassphrase.length >= 6) op.passphrase = newPassphrase;

    await op.save();

    // Update session
    req.session.user.name  = op.name;
    req.session.user.email = op.email;

    // Broadcast nama baru ke semua viewer map
    const io = req.app.get('io');
    if (io && op.lat) {
      io.emit('operator-position', {
        id:        op.operatorId,
        name:      op.name,
        role:      op.role,
        clearance: op.clearance,
        lat:       op.lat,
        lng:       op.lng,
        city:      op.city,
        status:    'online',
        updatedAt: new Date().toISOString()
      });
    }

    res.json({ success: true, user: { id: op.operatorId, name: op.name, email: op.email, role: op.role, clearance: op.clearance } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── API: channels ─────────────────────────────────────────────
router.get('/api/channels', async (req, res) => {
  try {
    res.json(await Channel.find({}).select('-_id -__v').lean());
  } catch { res.json([]); }
});

// ── API: sitreps ──────────────────────────────────────────────
router.get('/api/sitreps', async (req, res) => {
  try {
    const sitreps = await Sitrep.find({}).sort({ createdAt: -1 }).lean();
    res.json(sitreps.map(s => ({
      id: s.sitrepId, title: s.title, unit: s.unit, grid: s.grid,
      priority: s.priority, status: s.status, author: s.author, body: s.body,
      time: new Date(s.createdAt).toUTCString().split(' ')[4].slice(0, 5)
    })));
  } catch { res.json([]); }
});

router.post('/api/sitreps', async (req, res) => {
  const { title, unit, grid, body, priority } = req.body;
  try {
    const s = await Sitrep.create({ title, unit, grid, body, priority: priority || 'low', author: req.session.user.name });
    res.json({ success: true, sitrep: s });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/api/sitreps/:id', async (req, res) => {
  try {
    const s = await Sitrep.findOneAndUpdate({ sitrepId: req.params.id }, { status: req.body.status }, { new: true });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, sitrep: s });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── API: units ────────────────────────────────────────────────
router.get('/api/units', async (req, res) => {
  try {
    const units = await Unit.find({}).lean();
    res.json(units.map(u => ({ ...u, id: u.unitId })));
  } catch { res.json([]); }
});

router.post('/api/units', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    const unit = await Unit.create(req.body);
    const io = req.app.get('io');
    if (io) io.emit('unit-moved', { unit: unit.unitId, grid: unit.grid, lat: unit.lat, lng: unit.lng });
    res.json({ success: true, unit });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/api/units/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    const unit = await Unit.findOneAndUpdate({ unitId: req.params.id }, { ...req.body, updatedAt: new Date() }, { new: true });
    if (!unit) return res.status(404).json({ error: 'Not found' });
    const io = req.app.get('io');
    if (io) io.emit('unit-moved', { unit: unit.unitId, grid: unit.grid, lat: unit.lat, lng: unit.lng });
    res.json({ success: true, unit });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/units/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    await Unit.findOneAndDelete({ unitId: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── API: stats ────────────────────────────────────────────────
router.get('/api/stats', async (req, res) => {
  try {
    const [operators, channels, sitreps] = await Promise.all([
      Operator.countDocuments({ active: true }),
      Channel.countDocuments({ status: 'active' }),
      Sitrep.countDocuments({ status: 'pending' })
    ]);
    res.json({ operatorsOnline: operators, activeChannels: channels, pendingSitrep: sitreps, uptime: 99 });
  } catch { res.json({ operatorsOnline: 0, activeChannels: 0, pendingSitrep: 0, uptime: 99 }); }
});

// ── API: channel messages ─────────────────────────────────────
router.get('/api/messages/:channel', async (req, res) => {
  try {
    const msgs = await Message.find({ channel: req.params.channel }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(msgs.reverse().map(m => ({
      id: m._id, user: m.user, message: m.message, burn: m.burn, encrypted: m.encrypted,
      time: new Date(m.createdAt).toUTCString().split(' ')[4].slice(0, 5)
    })));
  } catch { res.json([]); }
});

// ── API: realtime positions ───────────────────────────────────
// GET all operator positions (for live map)
router.get('/api/positions', async (req, res) => {
  try {
    const ops = await Operator.find({ active: true, lat: { $ne: null } })
      .select('operatorId name role clearance lat lng city country posUpdatedAt').lean();
    res.json(ops.map(o => ({
      id:   o.operatorId,
      name: o.name,
      role: o.role,
      clearance: o.clearance,
      lat:  o.lat,
      lng:  o.lng,
      city: o.city,
      country: o.country,
      updatedAt: o.posUpdatedAt,
      status: 'active'
    })));
  } catch { res.json([]); }
});

// POST — update current user's position (GPS-precise or IP fallback)
router.post('/api/position', async (req, res) => {
  const me = req.session.user.id;

  try {
    let pos = null;

    // ── 1. Browser sent GPS coordinates (precise) ──────────
    if (req.body && req.body.lat != null && req.body.lng != null) {
      const { lat, lng, accuracy } = req.body;
      // Reverse geocode: GPS coords → city name (OpenStreetMap Nominatim, free)
      let city = '', country = '';
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
          { headers: { 'User-Agent': 'ARCANUM-SecureComm/1.0' } }
        );
        const d = await r.json();
        city    = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
        country = d.address?.country_code?.toUpperCase() || '';
      } catch (_) {}
      pos = { lat: parseFloat(lat), lng: parseFloat(lng), city, country, accuracy };
    }

    // ── 2. Fallback: IP geolocation (city-level ~1-5 km) ───
    if (!pos) {
      const ip = (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress || ''
      ).replace(/^::ffff:/, '');

      const isLocal = !ip || ip === '127.0.0.1' || ip === '::1'
        || ip.startsWith('192.168') || ip.startsWith('10.');

      if (!isLocal) {
        const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country`);
        const d = await r.json();
        if (d.status === 'success')
          pos = { lat: d.lat, lng: d.lon, city: d.city, country: d.country };
      }
    }

    // ── 3. Dev fallback: keep existing or assign random ID pos
    if (!pos) {
      const existing = await Operator.findOne({ operatorId: me }).select('lat lng city country').lean();
      if (existing?.lat) {
        // Tetap emit socket supaya map tetap tampil posisi walau data cached
        const io = req.app.get('io');
        if (io) {
          io.emit('operator-position', {
            id:        me,
            name:      req.session.user.name,
            role:      req.session.user.role,
            clearance: req.session.user.clearance,
            lat:       existing.lat,
            lng:       existing.lng,
            city:      existing.city,
            country:   existing.country,
            status:    'online',
            updatedAt: new Date().toISOString()
          });
        }
        res.json({ success: true, cached: true }); return;
      }
      const devPos = [
        { lat: -6.200, lng: 106.816, city: 'Jakarta',    country: 'ID' },
        { lat: -7.257, lng: 112.752, city: 'Surabaya',   country: 'ID' },
        { lat: -6.921, lng: 107.607, city: 'Bandung',    country: 'ID' },
        { lat: -8.409, lng: 115.188, city: 'Bali',       country: 'ID' },
        { lat: -7.797, lng: 110.370, city: 'Yogyakarta', country: 'ID' },
      ];
      pos = devPos[Math.floor(Math.random() * devPos.length)];
    }

    await Operator.updateOne({ operatorId: me }, {
      lat: pos.lat, lng: pos.lng,
      city: pos.city || '', country: pos.country || '',
      posUpdatedAt: new Date()
    });

    // Broadcast realtime to all map viewers
    const io = req.app.get('io');
    if (io) {
      io.emit('operator-position', {
        id:        me,
        name:      req.session.user.name,
        role:      req.session.user.role,
        clearance: req.session.user.clearance,
        lat:       pos.lat,
        lng:       pos.lng,
        city:      pos.city,
        country:   pos.country,
        accuracy:  pos.accuracy || null,
        status:    'online',
        updatedAt: new Date().toISOString()
      });
    }
    res.json({ success: true, pos });
  } catch (err) {
    console.error('Position error:', err.message);
    res.json({ success: false });
  }
});

// ── API: operators ────────────────────────────────────────────
router.get('/api/operators', async (req, res) => {
  try {
    const ops = await Operator.find({}).select('-passphrase').lean();
    res.json(ops.map(o => ({
      id: o.operatorId, name: o.name, role: o.role, email: o.email,
      clearance: o.clearance, active: o.active,
      lastLogin: o.lastLogin, createdAt: o.createdAt,
      city: o.city, country: o.country
    })));
  } catch { res.json([]); }
});

router.post('/api/operators', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    const op = await Operator.create(req.body);
    res.json({ success: true, operator: { id: op.operatorId, name: op.name, role: op.role, clearance: op.clearance } });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/api/operators/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    const { name, role, clearance, active, passphrase } = req.body;
    const update = { name, role, clearance: Number(clearance), active };
    if (passphrase && passphrase.length >= 6) update.passphrase = await bcrypt.hash(passphrase, 10);
    const op = await Operator.findOneAndUpdate({ operatorId: req.params.id }, update, { new: true }).select('-passphrase');
    if (!op) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, operator: op });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/operators/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
  try {
    await Operator.findOneAndUpdate({ operatorId: req.params.id }, { active: false });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── API: Invite Codes ─────────────────────────────────────────

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code.slice(0,4) + '-' + code.slice(4);
}

// GET semua invite codes (admin only)
router.get('/api/invite-codes', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const codes = await InviteCode.find({}).sort({ createdAt: -1 }).lean();
    res.json(codes);
  } catch { res.json([]); }
});

// POST buat invite code baru
router.post('/api/invite-codes', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Forbidden' });
  const { role, clearance, note, expiresHours } = req.body;
  try {
    // Generate unique code
    let code, attempts = 0;
    do {
      code = genCode();
      attempts++;
    } while (await InviteCode.exists({ code }) && attempts < 10);

    const expiresAt = expiresHours
      ? new Date(Date.now() + Number(expiresHours) * 3600 * 1000)
      : null;

    const inv = await InviteCode.create({
      code, role: role || 'OPS',
      clearance: Number(clearance) || 2,
      note: note || '',
      createdBy: u.id,
      expiresAt
    });
    res.json({ success: true, invite: inv });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE / revoke invite code
router.delete('/api/invite-codes/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    await InviteCode.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── API: Direct Messages ──────────────────────────────────────

// Conversations list
router.get('/api/dm/conversations', async (req, res) => {
  const me = req.session.user.id;
  try {
    const msgs = await DirectMessage.find({ $or: [{ from: me }, { to: me }] })
      .sort({ createdAt: -1 }).lean();

    const convMap = new Map();
    for (const msg of msgs) {
      const other = msg.from === me ? msg.to : msg.from;
      if (!convMap.has(other)) {
        convMap.set(other, {
          with: other,
          lastMessage: msg.message,
          lastType: msg.type,
          lastTime: msg.createdAt,
          unread: 0
        });
      }
      if (msg.to === me && !msg.readAt) {
        convMap.get(other).unread++;
      }
    }
    res.json([...convMap.values()]);
  } catch { res.json([]); }
});

// Messages with a user
router.get('/api/dm/:userId', async (req, res) => {
  const me = req.session.user.id;
  const other = req.params.userId;
  try {
    const msgs = await DirectMessage.find({
      $or: [{ from: me, to: other }, { from: other, to: me }]
    }).sort({ createdAt: 1 }).limit(200).lean();
    // Mark received messages as read
    await DirectMessage.updateMany({ from: other, to: me, readAt: null }, { readAt: new Date() });
    res.json(msgs);
  } catch { res.json([]); }
});

// File upload (image / video / audio / file)
router.post('/api/dm/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const me = req.session.user.id;
  const { to, message } = req.body;

  // Detect type from mimetype
  let type = 'file';
  if (req.file.mimetype.startsWith('image/')) type = 'image';
  else if (req.file.mimetype.startsWith('video/')) type = 'video';
  else if (req.file.mimetype.startsWith('audio/')) type = 'audio';

  const fileUrl = '/uploads/dm/' + req.file.filename;
  try {
    const dm = await DirectMessage.create({
      from: me, to,
      message: message || '',
      type, fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
    // Real-time delivery
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets');
    if (userSockets[to]) io.to(userSockets[to]).emit('dm-receive', dm);
    res.json(dm);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete a DM message
router.delete('/api/dm/message/:id', async (req, res) => {
  const me = req.session.user.id;
  try {
    const dm = await DirectMessage.findById(req.params.id);
    if (!dm) return res.status(404).json({ error: 'Not found' });
    if (dm.from !== me) return res.status(403).json({ error: 'Not yours' });
    // Delete file if exists
    if (dm.fileUrl) {
      const filePath = path.join(__dirname, '../public', dm.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await dm.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
