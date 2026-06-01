const mongoose = require('mongoose');

const SitrepSchema = new mongoose.Schema({
  sitrepId:  { type: String, unique: true },
  title:     { type: String, required: true },
  unit:      { type: String, required: true },
  grid:      { type: String },
  priority:  { type: String, enum: ['high', 'medium', 'low', 'info'], default: 'low' },
  status:    { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
  author:    { type: String, required: true },
  body:      { type: String },
  createdAt: { type: Date, default: Date.now }
});

SitrepSchema.pre('save', async function() {
  if (!this.sitrepId) {
    const count = await mongoose.model('Sitrep').countDocuments();
    const year = new Date().getFullYear();
    this.sitrepId = `STR-${year}-${String(count + 1).padStart(3, '0')}`;
  }
});

module.exports = mongoose.model('Sitrep', SitrepSchema);
