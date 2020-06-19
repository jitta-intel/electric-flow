const mongoose = require('mongoose')

const replySchema = new mongoose.Schema({
  electronId: mongoose.Schema.Types.ObjectId,
  boardName: String,
  resistorName: String,
  payload: {},
}, {
  timestamps: true
})

replySchema.index({ createdAt: -1 }, { expireAfterSeconds: 5 * 24 * 60 * 60 }) 
  


module.exports = replySchema
