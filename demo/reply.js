
const electrician = require('./electrician')
const mb1 = require('./mainBoard')

electrician.register(mb1)
//ObjectId("5afd154e092aa17313415fc8")
//e:5afd154e092aa17313415fc9
//e:5afd154e092aa17313415fca
const cbName = 'afterImportBoard'
const resistorName = 'import1'
const electronId = '5c94650c392f265a1aac6f29'
// ObjectId("5b1a05bf8480af761081dbc6")
const reply = {
  dd: `dummy reply for ${electronId}`
}

electrician.getMainBoard('mb1').handshake(cbName, {
  resistorName,
  electronId,
  reply
} )
