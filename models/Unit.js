const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema({
  unitId:    { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  role:      { type: String, enum: ['CMD', 'OPS', 'RECON', 'INTEL', 'LOG', '!'], default: 'OPS' },
  clearance: { type: Number, default: 2 },
  grid:      { type: String },
  lat:       { type: Number },
  lng:       { type: Number },
  status:    { type: String, enum: ['nominal', 'monitoring', 'threat'], default: 'nominal' },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Unit', UnitSchema);
