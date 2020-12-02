const Queue = require('bull')
const Promise = require('bluebird')
const moment = require('moment')
const debug = require('debug')('electrician:main_board')

const CircuitBoard = require('./circuit_board')

class MainBoard {
  constructor({ name }) {
    this.name = name
    this.circuitBoards = []
    this.retryDelay = 20000
    this.retryLimit = 1
    this.isStarted = false
  }

  // get All queues from every circuitBoard
  getQueues() {
    let queues = []
    this.circuitBoards.forEach((board) => {
      queues = [...queues, ...board.queues]
    })
    return queues
  }

  async cleanQueue(queueRetention) {
    return Promise.each(this.circuitBoards, async (board) => {
      return board.cleanQueue(queueRetention)
    })
  }

  addCircuitBoard(board) {
    if (board instanceof CircuitBoard) {
      // prevent single circuitBoard subscribe to multiple mainboard
      board.setParentName(this.name)
      return this.circuitBoards.push(board)
    }
    throw new Error('Object is not CircuitBoard.')
  }

  async start({ mongooseConnection, redisUrl, statsRedisUrl, slack }) {
    debug(`mb:${this.name} start.`)
    this.slack = slack
    this.circuitBoards.forEach((board) => {
      board.start({ mongooseConnection, redisUrl, statsRedisUrl })
    })
    this.DischargeModel = mongooseConnection.model('Discharge')
    this.ReplyModel = mongooseConnection.model('Reply')
    this.isStarted = true

    const doneQueue = new Queue(`mainboard:${this.name}:done`, redisUrl)
    this.doneQueue = doneQueue
    return 
  }

  async close() {
    debug(`close mainboard ${this.name}`)
    await Promise.each(this.circuitBoards, async (board) => board.close())
    this.isStarted = false
    return this.doneQueue ? this.doneQueue.close() : true
  }


  listen() {
    debug(`mb:${this.name} is listening.`)
    // listen all circuit board
    this.circuitBoards.forEach((board) => {
      board.listen({ doneQueue: this.doneQueue })
    })

    // listen when child discharge is complete
    this.doneQueue.process(async (job) => {
      const { dischargeId } = job.data
      const discharge = await this.DischargeModel.findOne({ _id: dischargeId }).lean()
      const { parentId } = discharge

      // if abort, stop discharging next board 
      const mainDischarge = await this.DischargeModel.findOne({ _id: parentId }).lean()
      if (mainDischarge.status === 'aborted') {
        debug('abort complete')
        return true
      }

      if (discharge.status === 'complete') {
        const discharging = await this.dischargeIfReady(parentId)
        if (!discharging) {
          if (!await this.isActiveSubDischarge(parentId)) {
            return this.doneDischarge(parentId)
          }
        }
      } else if (discharge.status === 'failed') {
        if (!await this.isActiveSubDischarge(parentId)) {
          return this.doneDischarge(parentId)
        }
      }
    })
  }

  async isActiveSubDischarge(parentId) {
    const activeSd = await this.DischargeModel.findOne({ parentId, status: 'active' })
    debug('found active subDischarge ', activeSd)
    return activeSd
  }

  async abortDischarge(parentId) {
    await this.DischargeModel.updateOne({ _id: parentId }, { status: 'aborted' })
    const mainDischarge = await this.DischargeModel.findOne({ _id: parentId })
    await this.notifySlack('abort', mainDischarge)
    // get active discharge
    const activeDischarge = await this.isActiveSubDischarge(parentId)
    if (activeDischarge) {
      // abort activeDischarge and all electron
      const circuitBoard = this.getCircuitBoardByName(activeDischarge.boardName)
      await circuitBoard.abort(activeDischarge._id)
      // console.log(` abort cb:${circuitBoard} with id ${activeDischarge._id} `)
    }
    return mainDischarge
  }

  // done main discharge, complete(failed) main discharge
  async doneDischarge(parentId) {
    let status
    let subDischarges = await this.DischargeModel.find({ parentId }).lean()
    if (subDischarges.every(sd => sd.status === 'complete')) {
      status = 'complete'
    } else if (subDischarges.find(sd => sd.status === 'failed')) {
      status = 'failed'
    }
    debug(`Finish [status:${status}] main d:${parentId} `)
    await this.DischargeModel.updateOne({ _id: parentId }, { status })
    const mainDischarges = await this.findDischarges({ _id: parentId })
    await this.notifySlack('done', mainDischarges[0])
    return this.retryIfAvailable(parentId, { type: 'Auto' })
  }

  async notifySlack(type, discharge) {
    const opts = {
      name: this.name,
      payload: discharge.payload
    }
    if (type === 'start') {
      opts.type = 'text'
      await this.slack.send('start', opts)
    } else if (type === 'done') {
      const diff = moment(discharge.updatedAt).diff(moment(discharge.createdAt))
      const duration = moment.duration(diff)
      let durationTxt = ''
      if (duration.hours() > 0) {
        durationTxt = `${duration.hours()}h`
      }
      durationTxt = `${durationTxt}${duration.minutes()}m`
      if (discharge.status === 'complete') {
        const integrityRatio = parseFloat(discharge.stats.integrityRatio * 100).toFixed(1)
        opts.color = 'good'
        await this.slack.send(`complete ${integrityRatio}% in ${durationTxt}`, opts)
      } else {
        const completeRatio = parseFloat(discharge.stats.completeRatio * 100).toFixed(1)
        opts.color = 'danger'
        await this.slack.send(`failed at ${completeRatio}% in ${durationTxt}`, opts)
      }
    } else if (type === 'retry') {
      opts.color = 'warning'
      await this.slack.send(`retry`, opts)
    } else if (type === 'abort') {
      opts.color = 'danger'
      await this.slack.send(`abort `, opts)
    }
  }

  shouldRetry(discharge) {
    return !discharge.retry || discharge.retry.length < this.retryLimit
  }

  // For autoRetry
  async retryIfAvailable(parentId) {
    const failedDischarges = await this.DischargeModel.find({ parentId, status: 'failed' }).lean()
    failedDischarges.forEach((failedDischarge) => {
      if (this.shouldRetry(failedDischarge)) {
        debug(`d:${failedDischarge._id} will retry in ${this.retryDelay} ms.`)
        const self = this
        return setTimeout(async () => {
          debug(`cb: ${failedDischarge.boardName} d:${failedDischarge._id} retry#${failedDischarge.retry.length} `)
          await self.retry(failedDischarge.boardName, failedDischarge._id, { type: 'Auto' })
        }, this.retryDelay)
      }
    })
  }


  getCircuitBoardByName(name) {
    return this.circuitBoards.find((board) => {
      return board.name === name
    })
  }

  async discharge(payload, opts) {
    if (this.isStarted === false) throw new Error(`Mainboard '${this.name}' haven't start.`)
    // create global Main discharge
    const mainDischarge = new this.DischargeModel({
      boardName: this.name,
      payload,
      type: 'Main',
      status: 'active',
      opts
    })
    await mainDischarge.save()
    await this.dischargeIfReady(mainDischarge._id)
    await this.notifySlack('start', mainDischarge)
    return mainDischarge
  }

  async dischargeIfReady(mainDischargeId) {
    const mainDischarge = await this.DischargeModel.findOne({ _id: mainDischargeId })
    const completeDependencies = await this.DischargeModel.findCompleteChildren(mainDischarge._id)
    let discharged = false
    await Promise.mapSeries(this.circuitBoards, async (board) => {
      // skip if board has complete
      if (completeDependencies.includes(board.name)) return false
      // if board met all dependencies
      if (!board.dependencies
        || board.dependencies.every(dep => completeDependencies.includes(dep))) {
        const isSuccess =
          await this.DischargeModel.markChildBoardDischarged(mainDischargeId, board.name)
        if (isSuccess) {
          discharged = true
          await board.discharge({ parentId: mainDischarge._id, payload: mainDischarge.payload, opts: mainDischarge.opts })
          return true
        }
      }
      return false
    })
    return discharged
  }

  // find discharges with stat
  async findDischarges(query = {}, fields = {}, sort = {}) {
    query.boardName = this.name
    sort.createdAt = -1
    let mainDischarges = await this.DischargeModel.find(query, fields, { sort }).lean()
    mainDischarges = Promise.map(mainDischarges, async (discharge) => {
      discharge.stats = await this.aggregateDischargeStat(discharge._id)
      return discharge
    })
    return mainDischarges
  }

  async aggregateDischargeStat(parentId) {
    const output = {
      completeRatio: 0,
      integrityRatio: 0
    }
    const subDischarges = await this.findSubDischarges(parentId)
    const dischargeWeight = 1 / (this.circuitBoards.length || 1)
    if (subDischarges.length === 0) {
      return output
    } else {
      output.integrityRatio = 1
    }
    subDischarges.forEach((d) => {
      output.completeRatio += d.stats.completeRatio * dischargeWeight
      // assign lowest complete rate to integrityRate
      if ((d.status === 'complete' || d.status === 'failed') && d.stats.completeRatio < output.integrityRatio) {
        output.integrityRatio = d.stats.completeRatio
      }
    })
    return output
  }

  async findSubDischarges(parentId, { resistorStat = false, includeNext = false } = {}) {
    let subDischarges = await this.DischargeModel.find({ parentId }).lean()
    subDischarges = Promise.map(subDischarges, async (discharge) => {
      const cb = this.getCircuitBoardByName(discharge.boardName) || {
        powerSource: {
          queue: {}
        },
        resistors: []
      }
      // if stats has not embed in discharge
      if (!discharge.stats) {
        debug('fetch stats from redis ', discharge._id)
        discharge.stats = await cb.stat.getSummary(discharge._id)
      }
      discharge.powerSource.queuePath = `/${this.name}/${cb.powerSource.queue.name}`
      if (resistorStat) {
        discharge.resistorStats = await Promise.map(cb.resistors, async (r) => {
          const stats = await r.stat.getSummary(discharge._id)
          const queuePath = `/${this.name}/${r.queue.name}`

          return {
            name: r.name,
            stats,
            queuePath
          }
        })
      }
      return discharge
    })
    return subDischarges
  }

  createNextSubDischarges(subDischarges) {
    const nextSubDischarges = []
    const dischargedNames = subDischarges.map(sd => sd.boardName)
    const nextNames = []
    this.circuitBoards.forEach((cb) => {
      if (dischargedNames.includes(cb.name)) {
        return false
      }
      const next = {
        boardName: cb.name,
        status: 'pending',
        dependencies: cb.dependencies,
        stats: {}
      }
      nextNames.push(next.boardName)
      if (next.dependencies.every(dep => nextNames.includes(dep)))
        nextSubDischarges.push(next)
      else
        nextSubDischarges.unshift(next)
    })
    return nextSubDischarges
  }

  async retry(circuitBoardName, dischargeId, { type = 'Manual' } = {}) {
    const board = this.getCircuitBoardByName(circuitBoardName)
    if (board) {
      const dischargeObj = await board.retryDischarge(dischargeId, { type })
      await this.DischargeModel.updateOne({ _id: dischargeObj.parentId }, { status: 'active' })
      const mainDischarges = await this.findDischarges({ _id: dischargeObj.parentId })
      await this.notifySlack('retry', mainDischarges[0])
      return dischargeObj
    }
    throw new Error(`MB:${this.name} CircuitBoard's name[${circuitBoardName}] is not registered.`)
  }

  async handshake(circuitBoardName, { electronId, resistorName, reply }) {
    const board = this.getCircuitBoardByName(circuitBoardName)
    if (board) {
      const replyObj = new this.ReplyModel({
        electronId,
        resistorName,
        boardName: board.name,
        payload: reply
      })
      await replyObj.save()
      return board.handshake(electronId, resistorName, replyObj._id)
    }
    throw new Error(`MB:${this.name} CircuitBoard's name[${circuitBoardName}] is not registered.`)
  }
}

module.exports = MainBoard
