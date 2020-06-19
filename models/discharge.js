const mongoose = require('mongoose')
const debug = require('debug')('electrician:dischargeSchema')

const dischargeSchema = new mongoose.Schema({
  boardName: String,
  boardType: { type: String, enum: ['Circuit', 'Main'] },
  parentId: { type: mongoose.Schema.Types.ObjectId },
  dischargedChildren: { type: [String], default: [] },
  // payload
  payload: {},
  opts: {
    priority: Number
  },
  status: { type: String, enum: ['waiting', 'active', 'inactive', 'complete', 'failed', 'aborted'], default: 'waiting' },
  retry: [{
    date: { type: Date, default: Date.now },
    no: Number,
    type: { type: String, enum: ['Auto', 'Manual']}
  }],
  powerSource: {
    status: { type: String, enum: ['waiting', 'active', 'complete', 'failed'], default: 'waiting' },
    totalElectrons: { type: Number, default: 0 },
    error: String,
    stack: {}
  },
  stats: mongoose.Schema.Types.Mixed
}, { timestamps: true })

// dischargeSchema.index()

dischargeSchema.statics.findCompleteChildren = async function findCompleteChildren(dischargeId) {
  const discharges = await this.find({ parentId: dischargeId, status: 'complete' })
  return discharges.map(d => d.boardName)
}

dischargeSchema.statics.markChildBoardDischarged =
  async function markChildBoardDischarged(dischargeId, childName) {
    const doc = await this.findOneAndUpdate(
      { _id: dischargeId },
      { $addToSet: { dischargedChildren: childName } }
    ).lean().exec()
    debug(`doc ${doc} / ${Object.keys(doc)} / children ${doc.dischargedChildren} / childName ${childName}`)
    // findOneAndUpdate will call findAndModify and this function will return the 'pre updated'
    // version of the doc, so if the doc doesn't have the field that we want to update then
    // it means that we have just updated it.
    return !doc || doc.dischargedChildren.indexOf(childName) === -1
  }

dischargeSchema.statics.updateRetry = async function updateRetry(discharge, { type = 'Auto' } = {}) {
  const retry = {
    no: discharge.retry.length +1,
    type
  }
  return this.updateOne({ _id: discharge._id }, { $push: { retry } })
}

dischargeSchema.statics.findSubDischargeIds = async function findSubDischargeIds(dischargeId) {
  const discharges = await this.find({ parentId: dischargeId })
  return discharges.map((d) => d._id)
}

module.exports = dischargeSchema
