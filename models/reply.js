const mongoose = require('mongoose')

const replySchema = new mongoose.Schema({
  electronId: mongoose.Schema.Types.ObjectId,
  boardName: String,
  resistorName: String,
  payload: {},
}, {
  timestamps: true,
  capped: {
    size: 40000000000, // 40GB ~ 50000 stocks
    max: 50000, // 1 day retention = 50,000 docs, 35 GB avg 700K/doc
    autoIndexId: true
  }
})
  


module.exports = replySchema
