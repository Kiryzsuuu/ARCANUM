const express    = require('express');
const router     = express.Router();
const path       = require('path');
const Operator   = require('../models/Operator');
const InviteCode = require('../models/InviteCode');

// ── IP Geolocation helper ─────────────────────────────────────
async function geolocateIP(ip) {
  // Clean IPv6-mapped IPv4
  const cleanIP = ip.replace(/^::ffff:/, '');
  // Skip localhost
  if (!cleanIP || cleanIP === '127.0.0.1' || cleanIP === '::1' || cleanIP.startsWith('192.168') || cleanIP.startsWith('10.')) {
    // Return random position in Indonesia for local dev
    const devPositions = [
      { lat: -6.200, lng: 106.816, city: 'Jakarta',    country: 'ID' },
      { lat: -7.257, lng: 112.752, city: 'Surabaya',   country: 'ID' },
      { lat: -6.921, lng: 107.607, city: 'Bandung',    country: 'ID' },
      { lat: -7.797, lng: 110.370, city: 'Yogyakarta', country: 'ID' },
      { lat: 3.595,  lng: 98.672,  city: 'Medan',      country: 'ID' },
      { lat: -8.409, lng: 115.188, city: 'Bali',       country: 'ID' },
    ];
    return devPositions[Math.floor(Math.random() * devPositions.length)];
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIP}?fields=status,lat,lon,city,country`);
    const data = await res.json();
    if (data.status === 'success') {
      return { lat: data.lat, lng: data.lon, city: data.city, country: data.country };
    }
  } catch (_) {}
  return null;
}

function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    ''
  );
}

// ── GET / — login page ─────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

// ── POST /login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { operatorId, passphrase } = req.body;
  if (!operatorId || !passphrase) return res.redirect('/?error=invalid');
  try {
    // Allow login by operatorId OR email
    const query = operatorId.includes('@')
      ? { email: operatorId.toLowerCase(), active: true }
      : { operatorId: operatorId.toUpperCase(), active: true };

    const operator = await Operator.findOne(query);
    if (!operator) return res.redirect('/?error=invalid');

    const valid = await operator.verifyPassphrase(passphrase);
    if (!valid) return res.redirect('/?error=invalid');

    // Geolocate IP asynchronously (don't block login)
    const ip = getClientIP(req);
    geolocateIP(ip).then(async (pos) => {
      if (pos) {
        operator.lat = pos.lat;
        operator.lng = pos.lng;
        operator.city = pos.city;
        operator.country = pos.country;
        operator.posUpdatedAt = new Date();
      }
      operator.lastLogin = new Date();
      try { await operator.save(); } catch (_) {}

      // Broadcast position update via Socket.io
      const io = req.app.get('io');
      if (io && pos) {
        io.emit('operator-position', {
          id:   operator.operatorId,
          name: operator.name,
          role: operator.role,
          lat:  pos.lat,
          lng:  pos.lng,
          city: pos.city,
          status: 'online'
        });
      }
    }).catch(() => {});

    req.session.user = {
      id:        operator.operatorId,
      name:      operator.name,
      role:      operator.role,
      clearance: operator.clearance,
      email:     operator.email,
      loginTime: new Date().toISOString()
    };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/?error=invalid');
  }
});

// ── GET /register ─────────────────────────────────────────────
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/register.html'));
});

// ── API: validate invite code (public) ───────────────────────
router.get('/api/invite/:code', async (req, res) => {
  try {
    const inv = await InviteCode.findOne({ code: req.params.code.toUpperCase() }).lean();
    if (!inv)          return res.status(404).json({ error: 'Kode tidak ditemukan' });
    if (inv.usedBy)    return res.status(400).json({ error: 'Kode sudah digunakan' });
    if (inv.expiresAt && new Date() > inv.expiresAt)
                       return res.status(400).json({ error: 'Kode sudah expired' });
    res.json({ valid: true, role: inv.role, clearance: inv.clearance, note: inv.note });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── POST /register ────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { code, operatorId, name, passphrase } = req.body;
  if (!code || !operatorId || !name || !passphrase)
    return res.redirect('/register?error=missing');
  try {
    const inv = await InviteCode.findOne({ code: code.toUpperCase() });
    if (!inv)        return res.redirect('/register?error=invalid_code');
    if (inv.usedBy)  return res.redirect('/register?error=used');
    if (inv.expiresAt && new Date() > inv.expiresAt)
                     return res.redirect('/register?error=expired');

    // Create the operator
    const op = await Operator.create({
      operatorId: operatorId.toUpperCase(),
      name: name.toUpperCase(),
      passphrase,
      role: inv.role,
      clearance: inv.clearance
    });

    // Mark code as used
    inv.usedBy = op.operatorId;
    inv.usedAt = new Date();
    await inv.save();

    // Auto login
    req.session.user = {
      id: op.operatorId, name: op.name,
      role: op.role, clearance: op.clearance,
      email: '', loginTime: new Date().toISOString()
    };
    res.redirect('/dashboard');
  } catch (err) {
    const msg = err.code === 11000 ? 'id_taken' : 'error';
    res.redirect('/register?error=' + msg + '&code=' + code);
  }
});

// ── GET /logout ───────────────────────────────────────────────
router.get('/logout', (req, res) => {
  const io = req.app.get('io');
  if (io && req.session.user) {
    io.emit('operator-offline', { id: req.session.user.id });
  }
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
