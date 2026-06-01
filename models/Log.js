const mongoose = require('mongoose');

const LOG_TYPES = [
  'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAIL', 'AUTH_REGISTER',
  'OPERATOR_CREATE', 'OPERATOR_UPDATE', 'OPERATOR_DEACTIVATE', 'OPERATOR_ACTIVATE', 'PROFILE_UPDATE',
  'SITREP_CREATE', 'SITREP_UPDATE',
  'CHANNEL_MSG', 'DM_MSG', 'DM_FILE',
  'UNIT_CREATE', 'UNIT_UPDATE', 'UNIT_DELETE',
  'INVITE_CREATE', 'INVITE_USE', 'INVITE_DELETE',
  'POSITION_UPDATE',
  'SYSTEM'
];

const LogSchema = new mongoose.Schema({
  actor:     { type: String, default: 'SYSTEM' },   // operatorId
  actorName: { type: String, default: 'SYSTEM' },
  type:      { type: String, enum: LOG_TYPES, required: true },
  action:    { type: String, required: true },       // deskripsi singkat
  target:    { type: String, default: '' },          // ID objek yang dipengaruhi
  details:   { type: mongoose.Schema.Types.Mixed },  // data tambahan bebas
  severity:  { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  ip:        { type: String, default: '' },
  createdAt: { type: Date, default: Date.now, expires: '90d' } // auto-delete setelah 90 hari
});

LogSchema.index({ createdAt: -1 });
LogSchema.index({ actor: 1, createdAt: -1 });
LogSchema.index({ type: 1, createdAt: -1 });
LogSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('Log', LogSchema);
