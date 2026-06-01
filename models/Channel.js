const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  name:      { type: String, required: true },
  status:    { type: String, enum: ['active', 'alert', 'inactive'], default: 'active' },
  clearance: { type: Number, default: 2 },
  unread:    { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Channel', ChannelSchema);
