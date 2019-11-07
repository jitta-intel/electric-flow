const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const api = require('../api/api')

const electricFlow = require('./electrician')
const ElectricFlowUI = require('../../electric-flow-ui')

const mb1 = require('./mainBoard')
electricFlow.register(mb1)

// const mb2 = require('./mainBoard2')
// electricFlow.register(mb2)


startServer = async () => {
  await electricFlow.start()
  const server = express()


  //server.use(bodyParser.urlencoded({ extended: false }))

  server.use(cors())
  
  
  // setTimeout(() => {
  electricFlow.applyApiMiddleware({ app: server, basePath: '' })
  ElectricFlowUI.applyMiddleware({ electricFlow, app: server, options: { appName: 'Demo' } })
  server.listen(3000, () => console.log('Example app listening on port 3000!'))
  // }, 3000)
  
}

startServer()

