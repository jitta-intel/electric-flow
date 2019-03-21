const electrician = require('./electrician')

const mb1 = require('./mainBoard')

electrician.register(mb1)

electrician.worker()
