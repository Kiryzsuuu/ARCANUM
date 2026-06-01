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
const Log           = require('../models/Log');
const addLog        = require('../utils/logger');

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
router.get('/logs',      (req, res) => sendView(res, 'logs.html'));

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

    addLog({ actor: op.operatorId, actorName: op.name, type:'PROFILE_UPDATE',
      action: 'Profil diperbarui', io: req.app.get('io') });
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
  const u = req.session.user;
  try {
    const s = await Sitrep.create({ title, unit, grid, body, priority: priority || 'low', author: u.name });
    addLog({ actor: u.id, actorName: u.name, type:'SITREP_CREATE',
      action: `Sitrep baru: ${title}`, target: s.sitrepId,
      details: { unit, grid, priority: s.priority }, io: req.app.get('io'),
      severity: priority === 'high' ? 'warning' : 'info' });
    res.json({ success: true, sitrep: s });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/api/sitreps/:id', async (req, res) => {
  const u = req.session.user;
  try {
    const s = await Sitrep.findOneAndUpdate({ sitrepId: req.params.id }, { status: req.body.status }, { new: true });
    if (!s) return res.status(404).json({ error: 'Not found' });
    addLog({ actor: u.id, actorName: u.name, type:'SITREP_UPDATE',
      action: `Sitrep ${req.params.id} → ${req.body.status.toUpperCase()}`,
      target: req.params.id, details: { status: req.body.status }, io: req.app.get('io') });
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
    const body = { ...req.body };
    // Auto-generate unitId unik jika sudah ada duplikat
    if (body.unitId) {
      const base = body.unitId.toUpperCase();
      let candidate = base, i = 2;
      while (await Unit.exists({ unitId: candidate })) candidate = base + i++;
      body.unitId = candidate;
    }
    const unit = await Unit.create(body);
    const io = req.app.get('io');
    if (io) io.emit('unit-moved', { unit: unit.unitId, grid: unit.grid, lat: unit.lat, lng: unit.lng });
    addLog({ actor: u.id, actorName: u.name, type:'UNIT_CREATE',
      action: `Field unit ditambahkan: ${unit.name} (${unit.unitId})`,
      target: unit.unitId, details: { role: unit.role, status: unit.status, lat: unit.lat, lng: unit.lng }, io });
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
    addLog({ actor: u.id, actorName: u.name, type:'UNIT_UPDATE',
      action: `Field unit diperbarui: ${unit.name} (${unit.unitId}) — status: ${unit.status}`,
      target: unit.unitId, details: req.body, io });
    res.json({ success: true, unit });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/units/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  try {
    const unit = await Unit.findOneAndDelete({ unitId: req.params.id });
    addLog({ actor: u.id, actorName: u.name, type:'UNIT_DELETE',
      action: `Field unit dihapus: ${unit?.name || req.params.id}`,
      target: req.params.id, io: req.app.get('io'), severity: 'warning' });
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

// Helper: build operator-position payload
function _buildPosPayload(user, pos, cached = false) {
  return {
    id:       user.id || user.operatorId,
    name:     user.name,
    role:     user.role,
    clearance:user.clearance,
    lat:      pos.lat,
    lng:      pos.lng,
    country:  pos.country  || '',
    province: pos.province || '',
    city:     pos.city     || '',
    district: pos.district || '',
    village:  pos.village  || '',
    accuracy: pos.accuracy || null,
    status:   'online',
    cached,
    updatedAt: new Date().toISOString()
  };
}

// ── API: realtime positions ───────────────────────────────────
router.get('/api/positions', async (req, res) => {
  try {
    const userSockets = req.app.get('userSockets') || {};
    const onlineIds   = Object.keys(userSockets);
    if (!onlineIds.length) return res.json([]);
    const ops = await Operator.find({ active: true, lat: { $ne: null }, operatorId: { $in: onlineIds } })
      .select('operatorId name role clearance lat lng country province city district village posUpdatedAt').lean();
    res.json(ops.map(o => ({
      id: o.operatorId, name: o.name, role: o.role, clearance: o.clearance,
      lat: o.lat, lng: o.lng,
      country: o.country, province: o.province, city: o.city,
      district: o.district, village: o.village,
      updatedAt: o.posUpdatedAt, status: 'online'
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
      let geoDetail = {};
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'ARCANUM-SecureComm/1.0' } }
        );
        const d = await r.json();
        const a = d.address || {};
        geoDetail = {
          country:  a.country_code?.toUpperCase() || '',
          province: a.state || a.province || '',
          city:     a.city || a.regency || a.town || a.county || '',
          district: a.suburb || a.city_district || a.district || '',
          village:  a.neighbourhood || a.quarter || a.village || a.hamlet || '',
        };
      } catch (_) {}
      pos = { lat: parseFloat(lat), lng: parseFloat(lng), accuracy, ...geoDetail };
    }

    // ── 2. Fallback: IP geolocation (city-level) ───────────
    if (!pos) {
      const ip = (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress || ''
      ).replace(/^::ffff:/, '');

      const isLocal = !ip || ip === '127.0.0.1' || ip === '::1'
        || ip.startsWith('192.168') || ip.startsWith('10.');

      if (!isLocal) {
        const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country,countryCode`);
        const d = await r.json();
        if (d.status === 'success')
          pos = { lat: d.lat, lng: d.lon, country: d.countryCode, province: d.regionName, city: d.city, district: '', village: '' };
      }
    }

    // ── 3. Dev fallback: keep existing or assign random ────
    if (!pos) {
      const existing = await Operator.findOne({ operatorId: me })
        .select('lat lng country province city district village').lean();
      if (existing?.lat) {
        const io = req.app.get('io');
        if (io) io.emit('operator-position', _buildPosPayload(req.session.user, existing, true));
        res.json({ success: true, cached: true }); return;
      }
      const devPos = [
        { lat: -6.200, lng: 106.816, country: 'ID', province: 'DKI Jakarta',   city: 'Jakarta',    district: 'Gambir',    village: 'Gambir' },
        { lat: -7.257, lng: 112.752, country: 'ID', province: 'Jawa Timur',    city: 'Surabaya',   district: 'Genteng',   village: 'Genteng' },
        { lat: -6.921, lng: 107.607, country: 'ID', province: 'Jawa Barat',    city: 'Bandung',    district: 'Coblong',   village: 'Dago' },
        { lat: -8.409, lng: 115.188, country: 'ID', province: 'Bali',          city: 'Denpasar',   district: 'Denpasar Selatan', village: 'Sanur' },
        { lat: -7.797, lng: 110.370, country: 'ID', province: 'DIY',           city: 'Yogyakarta', district: 'Kraton',    village: 'Kraton' },
      ];
      pos = devPos[Math.floor(Math.random() * devPos.length)];
    }

    await Operator.updateOne({ operatorId: me }, {
      lat: pos.lat, lng: pos.lng,
      country: pos.country || '', province: pos.province || '',
      city: pos.city || '', district: pos.district || '', village: pos.village || '',
      posUpdatedAt: new Date()
    });

    const io = req.app.get('io');
    if (io) io.emit('operator-position', _buildPosPayload(req.session.user, pos));
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
    const io = req.app.get('io');
    addLog({ actor: u.id, actorName: u.name, type:'OPERATOR_CREATE',
      action: `Operator baru dibuat: ${op.name} (${op.operatorId})`,
      target: op.operatorId, details: { role: op.role, clearance: op.clearance }, io,
      severity: 'warning' });
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
    const io = req.app.get('io');
    addLog({ actor: u.id, actorName: u.name, type:'OPERATOR_UPDATE',
      action: `Operator diperbarui: ${op.name} (${op.operatorId}) — role: ${op.role}, clearance: LVL ${op.clearance}, aktif: ${op.active}`,
      target: op.operatorId, details: update, io, severity: 'warning' });
    res.json({ success: true, operator: op });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/api/operators/:id', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Insufficient clearance' });
  if (req.params.id === req.session.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });
  try {
    const target = await Operator.findOne({ operatorId: req.params.id }).select('name').lean();
    await Operator.findOneAndUpdate({ operatorId: req.params.id }, { active: false });
    const io = req.app.get('io');
    addLog({ actor: u.id, actorName: u.name, type:'OPERATOR_DEACTIVATE',
      action: `Operator dinonaktifkan: ${target?.name || req.params.id} (${req.params.id})`,
      target: req.params.id, io, severity: 'critical' });
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
    addLog({ actor: u.id, actorName: u.name, type:'INVITE_CREATE',
      action: `Invite code dibuat: ${code} (${role||'OPS'} LVL ${clearance||2})`,
      target: code, details: { role, clearance, note, expiresAt }, io: req.app.get('io') });
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

// ── API: Logs ─────────────────────────────────────────────────
router.get('/api/logs', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const { type, severity, actor, from, to, limit = 200, page = 0 } = req.query;
    const filter = {};
    if (type     && type     !== 'all') filter.type     = type;
    if (severity && severity !== 'all') filter.severity = severity;
    if (actor)   filter.actor = actor;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(page) * Number(limit))
      .limit(Number(limit))
      .lean();
    const total = await Log.countDocuments(filter);
    res.json({ logs, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats ringkasan log
router.get('/api/logs/stats', async (req, res) => {
  const u = req.session.user;
  if (!['CHIEF','SA','ADMIN'].includes(u.role) && u.clearance < 3)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [total, todayCount, warnings, criticals, authFails] = await Promise.all([
      Log.countDocuments({}),
      Log.countDocuments({ createdAt: { $gte: today } }),
      Log.countDocuments({ severity: 'warning' }),
      Log.countDocuments({ severity: 'critical' }),
      Log.countDocuments({ type: 'AUTH_FAIL' })
    ]);
    // Top actors
    const topActors = await Log.aggregate([
      { $group: { _id: '$actorName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ]);
    res.json({ total, todayCount, warnings, criticals, authFails, topActors });
  } catch { res.json({}); }
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
