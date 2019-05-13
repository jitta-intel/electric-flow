const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const api = require('../api/api')

const electricFlow = require('./electrician')
const ElectricFlowUI = require('../../electric-flow-ui')

const mb1 = require('./mainBoard')

electricFlow.register(mb1)


const main = async () => {
  console.log('starting electricFlow')
  return electricFlow.start()
}
main().then(() => {
  // setTimeout(() => {
    console.log('closing electricFlow')
    return electricFlow.close()
  // }, 3000)
})
