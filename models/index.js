const dischargeSchema = require('./discharge')
const electronSchema = require('./electron')
const replySchema = require('./reply')

const schemas = [
  { name: 'Discharge', Schema: dischargeSchema },
  { name: 'Electron', Schema: electronSchema },
  { name: 'Reply', Schema: replySchema }
]

const initModel = (mongooseConnection) => {
  schemas.forEach(schema => mongooseConnection.model(schema.name, schema.Schema))
}

module.exports = { initModel }
