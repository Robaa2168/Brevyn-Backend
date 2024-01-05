// models/ReportAbuse 

const mongoose = require('mongoose');

const ReportAbuseSchema = new mongoose.Schema({
  Impact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Impact',
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharityUser',
    required: true
  },
  reportContent: {
    type: String,
    required: true,
    trim: true
  },
  reportDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved'],
    default: 'pending',
  },
  additionalInfo: {
    type: String,
    trim: true,
    required: false,
  }
}, { timestamps: true });



const ReportAbuse = mongoose.models.ReportAbuse || mongoose.model('ReportAbuse', ReportAbuseSchema);
module.exports = ReportAbuse;