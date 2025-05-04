const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  content: {
    type: String,
    required: function() {
      // Only require content if there is no media
      return !this.media || !this.media.url;
    }
  },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  media: {
    url: { type: String }, // base64 or URL
    type: { type: String }, // e.g., 'image', 'file', 'video', etc.
    name: { type: String }  // original filename
  },
  parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
});

module.exports = mongoose.model('Message', messageSchema); 