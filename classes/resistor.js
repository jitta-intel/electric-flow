const get = require('lodash').get
const moment = require('moment')
const schedule = require('node-schedule-tz')
const debug = require('debug')('electrician:resistor')
const debugQ = require('debug')('electrician:queue')
const Promise = require('bluebird')

const Stat = require('./stat')
const constants = require('../constants/resistor')

const HANDSHAKE_CLEANUP_SCHEDULE = '*/5 * * * *'

class Resistor {
  constructor({
    name,
    consume,
    replyHandler,
    type = constants.RESISTOR_TYPES.NORMAL,
    next,
    dependencies,
    retryLimit,
    retryDelay,
    timeout,
    startDelay
  } = {}) {
    this.name = name
    this.consume = consume
    this.type = type
    this.timeout = timeout || constants.RESISTOR_DEFAULT_TIMEOUT
    this.dependencies = dependencies || null
    if (this.dependencies && !Array.isArray(this.dependencies)) {
      this.dependencies = [this.dependencies]
    }
    this.next = next || null
    if (this.next && !Array.isArray(this.next)) {
      this.next = [this.next]
    }
    this.queue = null
    this.ElectronModel = null
    if (Object.values(constants.RESISTOR_TYPES).indexOf(type) === -1) {
      throw new Error('unrecognized resistor type')
    }
    this.replyHandler = replyHandler
    if (this.type === constants.RESISTOR_TYPES.HANDSHAKE && !this.replyHandler) {
      throw new Error('replyHandler is required for handshake')
    }
    this.startDelay = startDelay || 0
    this.retryLimit = retryLimit || constants.RESISTOR_RETRY_LIMIT
    this.retryDelay = retryDelay || constants.RESISTOR_RETRY_DELAY
  }

  setConnection({ mongooseConnection, statsRedisUrl }) {
    // MissingSchemaError will be thrown if model has not been registered
    this.ElectronModel = mongooseConnection.model('Electron')
    this.ReplyModel = mongooseConnection.model('Reply')
    this.stat = new Stat({
      prefix: `r:${this.name}`,
      redisUrl: statsRedisUrl,
      customStatuses: ['pushed', 'consumed']
    })
  }

  async close() {
    if (this.stat) this.stat.close()
    debug(`close resistor ${this.name}`)
    return this.queue ? this.queue.close() : true
  }

  async queryElectronData(electronId) {
    return this.ElectronModel.findOne({ _id: electronId })
  }

  async queryReplyData(replyId) {
    return this.ReplyModel.findOne({ _id: replyId }).lean()
  }

  setupQueue({ createQueue, redlock }) {
    this.queue = createQueue(`resistor:${this.name}`)
    this.queue.on('cleaned', (job, type) => {
      debugQ(`Cleaned ${this.name}Q %s %s jobs`, job.length, type)
    })
    if (this.isHandshake()) {
      this.redlock = redlock
      this.replyQueue = createQueue(`resistor:${this.name}:reply`)
      this.replyQueue.on('cleaned', (job, type) => {
        debugQ(`Cleaned ${this.name}.replyQ %s %s jobs`, job.length, type)
      })
    }
  }

  async cleanQueue(queueRetention) {
    await this.queue.clean(queueRetention)
    await this.queue.clean(queueRetention, 'failed')
    if (this.isHandshake()) {
      await this.replyQueue.clean(queueRetention)
      await this.replyQueue.clean(queueRetention, 'failed')
    }
  }

  isHandshake() {
    return this.type === constants.RESISTOR_TYPES.HANDSHAKE
  }

  push(electron) {
    debug('push electron', electron)
    const opts = {
      // NOTE: backoff only works when auto retry is made by bull itself
      // backoff: this.retryDelay
    }
    if (this.startDelay) opts.delay = this.startDelay
    if (electron.priority) opts.priority = electron.priority
    this.queue.add(electron, opts) //, { timeout: this.timeout })
  }

  async updateElectron(electronId, { field, value }) {
    const outputKey = `${field}.${this.name}`
    // console.log('updateElectron e:', electronId, 'field', field, 'value', value)
    return this.ElectronModel.update(
      { _id: electronId },
      {
        $set: {
          [outputKey]: value
        }
      }).exec()
  }

  async findWaitingReplyElectron() {
    const updatedAt = moment().subtract(this.timeout, 'ms').toDate()
    const statusKey = `resistorOutput.${this.name}.status`
    return this.ElectronModel.find(
      {
        updatedAt: { $lt: updatedAt },
        [statusKey]: constants.RESISTOR_OUTPUT_STATUS.WAITING
      }
    ).lean().exec()
  }

  async failNoreplyElectron() {
    const electrons = await this.findWaitingReplyElectron()
    const electronIds = electrons.map(e => e._id)
    debug('update timeout eIds', electronIds)
    const error = new Error(`Handshake reply timeout ${this.timeout} ms`)
    await this.ElectronModel.update(
      { _id: { $in: electronIds } },
      {
        $set: {
          [`resistorOutput.${this.name}.error`]: { message: error.message },
          [`resistorOutput.${this.name}.status`]: constants.RESISTOR_OUTPUT_STATUS.FAILED,
          error: {
            resistor: this.name,
            error: error.message
          }
        }
      }, { multi: true }
    )
    return Promise.each(electrons, (electron) => {
      console.error(`Resistor error e[${electron._id}]`, error)
      return this.failedFunc(electron, error)
    })
  }

  async updateResistorOutput(electronId, { value }) {
    return this.updateElectron(electronId, { field: 'resistorOutput', value })
  }

  updateRetry(electron) {
    const outputKey = `retry.${this.name}`
    return this.ElectronModel
      .update(
        { _id: electron._id },
        {
          $inc: {
            [outputKey]: 1
          }
        })
  }

  shouldRetry(electron) {
    const retryCount = this.getRetryCount(electron)
    return retryCount < this.retryLimit
  }

  getRetryCount(electron) {
    return get(electron, `retry.${this.name}`, 0)
  }

  async retryIfAvailable(job, electron) {
    if (this.shouldRetry(electron)) {

      await this.updateRetry(electron)
      debug(`r:${this.name} e:${electron._id} retry#${this.getRetryCount(electron)} in ${this.retryDelay} ms`)
      if (this.retryDelay > 0) {
        return setTimeout(async () => {
          job.retry()
        }, this.retryDelay)
      }
      return job.retry()
    }
    debug(`r:${this.name} e:${electron._id} failed due to exhaust all retry.`)
    await this.updateResistorOutput(electron._id, {
      status: constants.RESISTOR_OUTPUT_STATUS.FAILED
    })
    return false
  }

  async markElectronAsComplete(electron) {
    await this.stat.update(electron.dischargeId, electron._id, 'markedAsComplete')
    return this.ElectronModel
    .update(
      { _id: electron._id },
      { markedAsComplete: true }
    ).exec()
  }

  async run(electron) {
    // execute
    const outputData = await this.consume(electron, this.markElectronAsComplete.bind(this)) || {}
    // save output data to electron Collection
    debug(`saving ${JSON.stringify(outputData)} to ${electron._id}`)

    await this.updateResistorOutput(electron._id, {
      value: {
        status: this.isHandshake() ? constants.RESISTOR_OUTPUT_STATUS.WAITING : constants.RESISTOR_OUTPUT_STATUS.COMPLETE,
        timestamp: new Date(),
        data: { ...outputData }
      }
    })
  }

  async doneProcess(electron) {
    if (this.isHandshake()) {
      debug(`r:${this.name} e:${electron._id} handshake resistor is called`)
      // Check if electron was marked as completed after requesting to the other service
      const afterRequestedElectron = await this.queryElectronData(electron._id)
      if (afterRequestedElectron.markedAsComplete) {
        debug(`r:${this.name} e:${afterRequestedElectron._id} mark as completed after initial request`)
        // no need to pass this.next because this electron will be ground
        return this.nextFunc(afterRequestedElectron)
      }
      return false
    }
    debug(`r:${this.name} normal resistor is called`)
    return this.nextFunc(electron, this.next)
  }


  listen(nextFunc, failedFunc) {
    this.nextFunc = nextFunc
    this.failedFunc = failedFunc
    debug('add listshould call consume function and update electronener for ', this.name)
    this.queue.process(async (job) => {
      const { _id: electronId, dischargeId } = job.data
      this.stat.update(dischargeId, electronId, 'consumed')
      // query electron data
      const electron = await this.queryElectronData(electronId)
      if (!electron) throw new Error(`Electron:${electronId} is missing.`)
      // check abort before start working
      if (electron.abort) {
        // update abort stat
        await this.stat.update(dischargeId, electronId, 'aborted')
        debug(`r:${this.name} aborted e:${electronId}.`)
      } else {
        await this.run(electron)
        debug(`r:${this.name} consumed e:${electronId}.`)
      }
      return this.doneProcess(electron)
    })

    this.queue.on('failed', async (job, error) => {
      const { _id: electronId, dischargeId } = job.data
      const electron = await this.queryElectronData(electronId)
      debug(`r:${this.name} - job failed e:${electronId}`)
      console.error(`Resistor error e[${electronId}]`, error)
      await this.updateResistorOutput(electronId, {
        value: { error: { message: error.message, stack: error.stack } }
      })
      await this.updateElectron(electronId, {
        field: 'error',
        value: { resistor: this.name, error: error.message, stack: error.stack }
      })
      const retrying = await this.retryIfAvailable(job, electron)
      if (retrying === false) {
        return this.failedFunc(electron, error)
      }
    })

    this.queue.on('stalled', (job) => {
      console.log(`r:${this.name} - job stalled e:${job.data._id}`)
      // A job has been marked as stalled. This is useful for debugging job
      // workers that crash or pause the event loop.
    })

    this.queue.on('active', (job) => {
      debug(`r:${this.name} - job started e:${job.data._id}`)
    })
    this.queue.on('completed', (job) => {
      debug(`r:${this.name} - job complete e:${job.data._id}`)
    })

    if (this.type === constants.RESISTOR_TYPES.HANDSHAKE) {
      this.listenReply(nextFunc, failedFunc)
      // handshake need schedule process to clean no response handshake
      debug(`set timeout cleaner schedule for ${this.timeout}ms`)
      this.handshakeTimeoutCleaner = schedule.scheduleJob(HANDSHAKE_CLEANUP_SCHEDULE, async () => {
        const resource = `r:${this.name}:hs:cleaner:lock`
        return this.redlock.lock(resource, 2000)
        .then(async (lock) => {
          const result = await this.failNoreplyElectron()//.then(() => new Promise(res => setTimeout(res, 3000)))
          debug(`cleaning r:${this.name} handshake job`, result)
          return lock.unlock().catch((err) => console.error(err))
        }).catch(err => err)
      })
    }
  }


  async runReplyHandler(electron, replyData) {
    debug(`runReplyhandler ${electron._id} isReplyHandler exists ${!!this.replyHandler}`)
    const outputData = await this.replyHandler(electron, replyData, this.markElectronAsComplete.bind(this)) || {}
    // save output data to electron Collection
    debug(`saving ${JSON.stringify(outputData)} to ${electron._id}`)
    return this.updateResistorOutput(electron._id, {
      value: {
        status: constants.RESISTOR_OUTPUT_STATUS.COMPLETE,
        timestamp: new Date(),
        data: { ...outputData }
      }
    })
  }


  pushReply({ electronId, replyId }) {
    if (this.isHandshake()) {
      debug('push to replyQueue', electronId, replyId)
      return this.replyQueue.add({ electronId, replyId })
    }
    throw new Error('pushReply must use with handshake type ')
  }

  isReplyAlreadyProcess(electron) {
    const outputStatusKey = `resistorOutput.${this.name}.status`
    const status = get(electron, outputStatusKey)
    return status === constants.RESISTOR_OUTPUT_STATUS.COMPLETE
  }

  listenReply(nextFunc, failedFunc) {
    this.replyQueue.process(async (job) => {
      debug(`listenReply r:${this.name} got replied`)
      const { electronId, replyId } = job.data
      // query electron data
      let electron
      let reply
      try {
        electron = await this.queryElectronData(electronId)
        // prevent multiple reply call
        if (this.isReplyAlreadyProcess(electron)) {
          debug(`r:${this.name} reply from e:${electronId} is already processed.`)
          return false
        }
        reply = await this.queryReplyData(replyId)
        if (!electron) throw new Error(`Electron:${electronId} is missing.`)
        await this.runReplyHandler(electron, reply)
        debug(`r:${this.name} got replied from e:${electronId}.`)
        return nextFunc(electron, this.next)
      } catch (error) {
        // Failed
        console.error(`Resistor error e[${electronId}]`, error)
        const retrying = await this.retryIfAvailable(job, electron)
        if (retrying === false) {
          await failedFunc(electron, error)
        }
        throw error
      }
    })

    this.replyQueue.on('stalled', (job) => {
      console.log(`r:${this.name} - replyJob stalled e:${job.data.electronId}`)
      // A job has been marked as stalled. This is useful for debugging job
      // workers that crash or pause the event loop.
    })

    this.replyQueue.on('active', (job) => {
      debug(`r:${this.name} - replyJob started e:${job.data.electronId}`)
    })
    this.replyQueue.on('completed', (job) => {
      debug(`r:${this.name} - replyJob complete e:${job.data.electronId}`)
    })
  }
}

module.exports = Resistor
