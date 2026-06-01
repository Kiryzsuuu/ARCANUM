const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  channel:   { type: String, required: true, index: true },
  user:      { type: String, required: true },
  message:   { type: String, required: true },
  burn:      { type: Boolean, default: false },
  encrypted: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' }
});

module.exports = mongoose.model('Message', MessageSchema);
