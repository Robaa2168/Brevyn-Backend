// models/Impact.js
const mongoose = require('mongoose');

const ImpactSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  imageUrl: {
    type: [String],
    required: [true, 'At least one image URL is required'],
    validate: {
      validator: function(array) {
        return Array.isArray(array) && array.length > 0;
      },
      message: 'You should provide at least one image.'
    }
  },
  likes: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0,
  },
  shares: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now
  },
});

// Compile model from schema
const Impact = mongoose.models.Impact || mongoose.model('Impact', ImpactSchema);

module.exports = Impact;
