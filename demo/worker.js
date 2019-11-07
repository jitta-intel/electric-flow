const electrician = require('./electrician')

const mb1 = require('./mainBoard')
electrician.register(mb1)


// const mb2 = require('./mainBoard2')
// electrician.register(mb2)

electrician.worker()
