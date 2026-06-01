const mongoose = require('mongoose');

const DMSchema = new mongoose.Schema({
  from:      { type: String, required: true, index: true },
  to:        { type: String, required: true, index: true },
  message:   { type: String, default: '' },
  type:      { type: String, enum: ['text', 'image', 'video', 'audio', 'file'], default: 'text' },
  fileUrl:   { type: String },
  fileName:  { type: String },
  fileSize:  { type: Number },
  mimeType:  { type: String },
  duration:  { type: Number },
  readAt:    { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

DMSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model('DirectMessage', DMSchema);
