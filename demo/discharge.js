const electrician = require('./electrician')
const mb1 = require('./mainBoard')


electrician.register(mb1)

electrician.start().then(() => {
  electrician.discharge('mb1', { market: 'TH' })
})





// electrician.getMainBoard('mb1').retry('importStockBoard', mongoose.Types.ObjectId("5af9682b53cc24e07efe9965")).then(() => console.log('dd'))
