const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const OperatorSchema = new mongoose.Schema({
  operatorId:  { type: String, required: true, unique: true, uppercase: true },
  email:       { type: String, lowercase: true, trim: true, default: '' },
  passphrase:  { type: String, required: true },
  name:        { type: String, required: true, uppercase: true },
  role:        { type: String, enum: ['CHIEF', 'SA', 'ADMIN', 'CMD', 'OPS', 'RECON', 'INTEL', 'LOG'], default: 'OPS' },
  clearance:   { type: Number, min: 1, max: 4, default: 2 },
  active:      { type: Boolean, default: true },
  lastLogin:   { type: Date },
  // Real-time position (updated from IP geolocation on login)
  lat:         { type: Number, default: null },
  lng:         { type: Number, default: null },
  city:        { type: String, default: '' },
  country:     { type: String, default: '' },
  posUpdatedAt:{ type: Date },
  createdAt:   { type: Date, default: Date.now }
});

OperatorSchema.pre('save', async function() {
  if (!this.isModified('passphrase')) return;
  this.passphrase = await bcrypt.hash(this.passphrase, 10);
});

OperatorSchema.methods.verifyPassphrase = function(plain) {
  return bcrypt.compare(plain, this.passphrase);
};

// SA or ADMIN or clearance 3+ can manage users
OperatorSchema.methods.canManageUsers = function() {
  return ['CHIEF', 'SA', 'ADMIN'].includes(this.role) || this.clearance >= 3;
};

module.exports = mongoose.model('Operator', OperatorSchema);
