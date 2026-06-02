const mongoose = require('mongoose');

const ZoneSchema = new mongoose.Schema({
  zoneId:    { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  type:      { type: String, enum: ['restricted', 'command', 'ops', 'alert', 'neutral'], default: 'restricted' },
  shape:     { type: String, enum: ['rectangle', 'circle'], default: 'rectangle' },
  // Rectangle: bounds [[lat1,lng1],[lat2,lng2]]
  bounds:    { type: [[Number]], default: [] },
  // Circle: center + radius (meters)
  center:    { lat: { type: Number }, lng: { type: Number } },
  radius:    { type: Number, default: 1000 },
  clearance: { type: Number, default: 1 },
  active:    { type: Boolean, default: true },
  createdBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Zone', ZoneSchema);
