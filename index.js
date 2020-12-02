const mongoose = require('mongoose')
const Promise = require('bluebird')
const bodyParser = require('body-parser')
const debug = require('debug')('electric-flow')
const { initModel } = require('./models')

const MainBoard = require('./classes/main_board')
const CircuitBoard = require('./classes/circuit_board')
const PowerSource = require('./classes/power_source')
const Resistor = require('./classes/resistor')
const api = require('./api/api')
const Slack = require('./lib/slack')

class Electrician {
  constructor({
    mongoUrl,
    redisUrl,
    statsRedisUrl,
    queueRetention, // ms
    enableSlack = false,
    slack = {}
  }) {
    this.mongoUrl = mongoUrl
    this.redisUrl = redisUrl
    this.statsRedisUrl = statsRedisUrl || this.redisUrl
    this.mainBoard = {}
    this.queueRetention = queueRetention || 2 * 24 * 60 * 60 * 1000
    this.slack = new Slack({
      enable: enableSlack,
      webhookUrl: slack.webhookUrl,
      channel: slack.channel,
      username: slack.username
    })
  }

  // Register board
  register(mainBoard) {
    this.mainBoard[mainBoard.name] = mainBoard
  }

  // init all board connection
  async start() {
    this.mongooseConnection = mongoose.createConnection(this.mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true
    })
    initModel(this.mongooseConnection)
    const mbs = this.getMainBoards()
    debug('ElectricFlow is running')
    return Promise.each(mbs, (mb) => {
      return this.mainBoard[mb.name].start({
        mongooseConnection: this.mongooseConnection,
        redisUrl: this.redisUrl,
        statsRedisUrl: this.statsRedisUrl,
        slack: this.slack
      })
    })
  }

  // close all board connection
  async close() {
    const mbs = this.getMainBoards()
    debug('close mongo db')
    await this.mongooseConnection.close()
    debug(`close electricFlow`)
    return Promise.each(mbs, ({ name }) => this.mainBoard[name].close())
  }

  async worker() {
    await this.start()
    return Object.keys(this.mainBoard).forEach(boardName => this.mainBoard[boardName].listen())
  }

  getMainBoard(name) {
    return this.mainBoard[name]
  }

  getMainBoards() {
    const names = Object.keys(this.mainBoard)
    return names.map((name) => {
      const mb = this.mainBoard[name]
      return {
        name: mb.name
      }
    })
  }

  async discharge(boardName, payload, opts = {}) {
    if (this.mainBoard[boardName]) {
      return this.mainBoard[boardName].discharge(payload, opts)
    }
    throw new Error(`Mainboard:${boardName} is not registered.`)
  }

  async abort(boardName, parentId) {
    if (this.mainBoard[boardName]) {
      return this.mainBoard[boardName].abortDischarge(payload)
    }
    throw new Error(`Mainboard:${boardName} is not registered.`)
  }

  async cleanQueue() {
    return Promise.each(Object.keys(this.mainBoard), (boardName) => {
      return this.mainBoard[boardName].cleanQueue(this.queueRetention)
    })
  }
  


  async findDischarge(dischargeId) {
    const _id = mongoose.Types.ObjectId(dischargeId)
    return this.mongooseConnection.model('Discharge').findOne(_id)
  }

  // getArenaUI(basePath, port) {
  //   let queues = []
  //   Object.keys(this.mainBoard).forEach((boardName) => {
  //     queues = [...queues, ...this.mainBoard[boardName].getQueues()]
  //   })
  //   return arena({ queues }, { basePath, port })
  // }

  getQueues() {
    let queues = []
    Object.keys(this.mainBoard).forEach((boardName) => {
      queues = [...queues, ...this.mainBoard[boardName].getQueues()]
    })
    return queues
  }

  applyApiMiddleware({ app, basePath = '' }) {
    this.basePath = basePath
    this.apiPath = `${basePath}/api`
    // this.arenaPath = `${basePath}/arena`
    // this.arenaPort = arenaPort
    // parse application/json
    app.use(bodyParser.json())
    app.use(this.apiPath, api(this))
    // app.use(this.getArenaUI(this.arenaPath, this.arenaPort))
  }
}


Electrician.MainBoard = MainBoard
Electrician.CircuitBoard = CircuitBoard
Electrician.PowerSource = PowerSource
Electrician.Resistor = Resistor
Electrician.api = api

module.exports = Electrician
