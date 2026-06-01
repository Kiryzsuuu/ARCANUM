require('dotenv').config();
const mongoose = require('mongoose');
const Operator = require('./models/Operator');
const Channel  = require('./models/Channel');
const Sitrep   = require('./models/Sitrep');
const Unit     = require('./models/Unit');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await Promise.all([
    Operator.deleteMany({}),
    Channel.deleteMany({}),
    Sitrep.deleteMany({}),
    Unit.deleteMany({})
  ]);
  console.log('Cleared existing data');

  // ── Operators ─────────────────────────────────────────────
  await Operator.create([
    // Super Admin — pimpinan tertinggi
    {
      operatorId: 'SA-000',
      email:      'maskiryz23@gmail.com',
      passphrase: 'opet123',
      name:       'RIZKY',
      role:       'CHIEF',
      clearance:  4
    },
    { operatorId: 'OPS-001', passphrase: 'arcanum2024', name: 'R.SANJAYA', role: 'CMD',   clearance: 3 },
    { operatorId: 'OPS-002', passphrase: 'alpha2024',   name: 'ALPHA-1',   role: 'OPS',   clearance: 2 },
    { operatorId: 'OPS-003', passphrase: 'bravo2024',   name: 'BRAVO-2',   role: 'RECON', clearance: 2 },
    { operatorId: 'OPS-004', passphrase: 'delta2024',   name: 'DELTA-1',   role: 'OPS',   clearance: 2 },
    { operatorId: 'OPS-005', passphrase: 'intel2024',   name: 'GOLF-4',    role: 'INTEL', clearance: 3 },
  ]);
  console.log('Operators seeded');

  // ── Channels ──────────────────────────────────────────────
  await Channel.create([
    { id: 'alpha',   name: 'OPS-ALPHA // Kota Selatan', status: 'active',   clearance: 2, unread: 7 },
    { id: 'delta',   name: 'OPS-DELTA // Utara',        status: 'active',   clearance: 2, unread: 0 },
    { id: 'intel',   name: 'INTEL // Sektor 4',          status: 'alert',    clearance: 3, unread: 2 },
    { id: 'recon',   name: 'RECON // Foxtrot',           status: 'active',   clearance: 2, unread: 0 },
    { id: 'command', name: 'COMMAND // General',         status: 'active',   clearance: 2, unread: 0 },
    { id: 'supply',  name: 'LOGISTICS // Supply',        status: 'inactive', clearance: 2, unread: 0 },
  ]);
  console.log('Channels seeded');

  // ── Sitreps ───────────────────────────────────────────────
  const year = new Date().getFullYear();
  await Sitrep.create([
    { sitrepId: `STR-${year}-047`, title: 'Kontak visual tidak teridentifikasi — Tango-3', priority: 'high',   status: 'pending',  unit: 'FOXTROT',   author: 'FOX-3',   grid: 'QR-7831', body: 'Kontak visual dengan elemen tidak teridentifikasi di sektor utara grid QR-7831.' },
    { sitrepId: `STR-${year}-046`, title: 'Pergerakan kendaraan tidak terjadwal — Sektor 7', priority: 'medium', status: 'pending',  unit: 'INTEL',     author: 'GOLF-4',  grid: 'QR-7750', body: 'Terdeteksi 2 kendaraan tak terjadwal memasuki Sektor 7.' },
    { sitrepId: `STR-${year}-045`, title: 'Gangguan sinyal komunikasi — Grid QR-7750',       priority: 'medium', status: 'pending',  unit: 'OPS-DELTA', author: 'DELTA-1', grid: 'QR-7750', body: 'Interferensi sinyal terdeteksi di grid QR-7750.' },
    { sitrepId: `STR-${year}-044`, title: 'Sektor barat bersih — laporan rutin ALPHA',       priority: 'low',    status: 'reviewed', unit: 'OPS-ALPHA', author: 'ALPHA-1', grid: 'QR-7814', body: 'Laporan rutin unit ALPHA-1. Sektor barat bersih.' },
    { sitrepId: `STR-${year}-043`, title: 'Resupply diterima — titik Bravo terkonfirmasi',   priority: 'info',   status: 'closed',   unit: 'LOGISTICS', author: 'SUP-2',   grid: 'QR-7820', body: 'Pengiriman resupply berhasil diterima di titik Bravo.' },
  ]);
  console.log('Sitreps seeded');

  // ── Units ─────────────────────────────────────────────────
  // Posisi di Indonesia (real koordinat)
  await Unit.create([
    { unitId: 'CMD', name: 'CMD-SANJAYA', role: 'CMD',   clearance: 3, grid: 'JKT-CMD',  lat: -6.200, lng: 106.816, status: 'nominal' },
    { unitId: 'A1',  name: 'ALPHA-1',    role: 'OPS',   clearance: 2, grid: 'SBY-A1',   lat: -7.257, lng: 112.752, status: 'nominal' },
    { unitId: 'B2',  name: 'BRAVO-2',    role: 'RECON', clearance: 2, grid: 'BDG-B2',   lat: -6.921, lng: 107.607, status: 'nominal' },
    { unitId: 'F3',  name: 'FOXTROT-3',  role: 'RECON', clearance: 2, grid: 'YGY-F3',   lat: -7.797, lng: 110.370, status: 'monitoring' },
    { unitId: 'D1',  name: 'DELTA-1',    role: 'OPS',   clearance: 2, grid: 'MDN-D1',   lat: 3.595,  lng: 98.672,  status: 'nominal' },
  ]);
  console.log('Units seeded');

  console.log('\nSeed complete. Login credentials:');
  console.log('  SA-000  / opet123      (SUPER ADMIN LVL 4) — maskiryz23@gmail.com');
  console.log('  OPS-001 / arcanum2024  (CMD LVL 3)');
  console.log('  OPS-002 / alpha2024    (OPS LVL 2)');
  console.log('  OPS-003 / bravo2024    (RECON LVL 2)');
  console.log('  OPS-004 / delta2024    (OPS LVL 2)');
  console.log('  OPS-005 / intel2024    (INTEL LVL 3)');

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
