const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const api = require('../api/api')

const electrician = require('./electrician')
const ElectricianUI = require('../../electric-flow-ui')

const mb1 = require('./mainBoard')

electrician.register(mb1)


const server = express()

const appApi = api(electrician)

server.use(bodyParser.urlencoded({ extended: false }))
// parse application/json
server.use(bodyParser.json())
server.use(cors())
server.use('/api', appApi)
server.use('/ecdash', ElectricianUI({
  api: '/api',
  basePath: '/ecdash',
  arenaPath: ''
}))
server.use(electrician.getArenaUI())

server.listen(3000, () => console.log('Example app listening on port 3000!'))
