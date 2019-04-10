const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const api = require('../api/api')

const electricFlow = require('./electrician')
const ElectricFlowUI = require('../../electric-flow-ui')

const mb1 = require('./mainBoard')

electricFlow.register(mb1)


const server = express()


server.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
server.use(bodyParser.json())
server.use(cors())


electricFlow.applyApiMiddleware({ app: server, basePath: '' })
ElectricFlowUI.applyMiddleware({ electricFlow, app: server })


server.listen(3000, () => console.log('Example app listening on port 3000!'))
