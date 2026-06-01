const mongoose = require('mongoose');

const InviteCodeSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true, uppercase: true },
  role:      { type: String, enum: ['SA','ADMIN','CMD','OPS','RECON','INTEL','LOG'], default: 'OPS' },
  clearance: { type: Number, min: 1, max: 4, default: 2 },
  note:      { type: String, default: '' },          // catatan admin, misal "untuk tim alpha"
  createdBy: { type: String, required: true },
  usedBy:    { type: String, default: null },         // operatorId yang pakai
  usedAt:    { type: Date,   default: null },
  expiresAt: { type: Date,   default: null },         // null = tidak expired
  createdAt: { type: Date,   default: Date.now }
});

InviteCodeSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

InviteCodeSchema.virtual('isUsed').get(function() {
  return !!this.usedBy;
});

module.exports = mongoose.model('InviteCode', InviteCodeSchema);
