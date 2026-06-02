const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  status:    { type: String, enum: ['active', 'alert', 'inactive'], default: 'active' },
  clearance: { type: Number, default: 2 },
  unread:    { type: Number, default: 0 },
  // members: kosong = publik (semua bisa lihat sesuai clearance)
  //           berisi = privat (hanya member yang bisa akses)
  members:   [{ type: String }],  // array operatorId
  createdBy: { type: String, default: '' },
  topic:     { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Channel', ChannelSchema);
