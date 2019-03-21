const mongoose = require('mongoose')

const electronSchema = new mongoose.Schema({
  dischargeId: mongoose.Schema.Types.ObjectId,
  data: {},
  /* {
    resistor1: {
      status: 'complete'
    },
    resistor1: {
      status: ''
    }
  }
   */
  priority: Number,
  markedAsComplete: Boolean,
  resistorOutput: {},
  retry: {}
}, {
  timestamps: true
})

electronSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 5 * 24 * 60 * 60 })

module.exports = electronSchema
