const electrician = require('./electrician')
const mb1 = require('./mainBoard')


const electrician = new Electrician({
  mongoUrl: 'mongodb://localhost:27017/electrician',
  redisUrl: 'redis://localhost:6379',
  statsRedisUrl: 'redis://localhost:6379/1'
})

electrician.register(mb1)

electrician.discharge('mb1', { market: 'TH' }, { priority: 1 })


// electrician.getMainBoard('mb1').retry('importStockBoard', mongoose.Types.ObjectId("5af9682b53cc24e07efe9965")).then(() => console.log('dd'))
