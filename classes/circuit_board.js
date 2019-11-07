const Queue = require('bull')
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Redis = require('ioredis')
const Redlock = require('redlock')
const Stat = require('./stat')
const _ = require('lodash')
const debug = require('debug')('electrician:circuit_board')
const resistorConstants = require('../constants/resistor')
const PowerSource = require('./power_source')


const DEFAULT_COMPLETE_THRESHOLD = 0.9

class CircuitBoard {
  constructor({ name, completeThreshold } = {}) {
    this.name = name
    this.powerSource = null
    this.redlock = null
    this.connected = false
    this.resistors = []
    this.queues = {}
    this.queueList = []
    this.completeThreshold = completeThreshold || DEFAULT_COMPLETE_THRESHOLD
  }

  setParentName(parentName) {
    if (this.connected) {
      throw new Error(`CircuitBoard:${this.name} can not connect to multiple Mainboard or reuse. Please create new CircuitBoard.'`)
    }
    this.parentName = parentName
    this.connected = true
  }

  getQueueName(resistorName) {
    return `${this.parentName}:${this.name}:${resistorName}`
  }

  addDependency(dependentBoard) {
    this.dependencies = this.dependencies || []
    this.dependencies.push(dependentBoard.name)
  }

  start({ mongooseConnection, redisUrl, statsRedisUrl }) {
    const result = this.checkAllDependencies()
    if (result.status === false) {
      console.error(result.errors)
      return false
    }
    debug(`cb:${this.name} start.`)
    this.redlock = new Redlock([new Redis(redisUrl)], { retryCount: 0 })
    this.setConnection({ mongooseConnection, statsRedisUrl})
    this.setQueue({ redisUrl })
    this.powerSource.setConnection({ mongooseConnection })
    this.resistors.forEach(resistor => resistor.setConnection({ mongooseConnection, statsRedisUrl }))
  }

  setConnection({ mongooseConnection, statsRedisUrl }) {
    // MissingSchemaError will be thrown if model has not been registered
    this.DischargeModel = mongooseConnection.model('Discharge')
    this.ElectronModel = mongooseConnection.model('Electron')
    this.stat = new Stat({ prefix: `cb:${this.name}`, redisUrl: statsRedisUrl })
  }

  async close() {
    if (this.stat) this.stat.close()
    debug(`close circuit board ${this.name}`)
    if (this.redlock) await this.redlock.quit()
    if (this.powerSource) await this.powerSource.close()
    return Promise.each(this.resistors, async (resistor) => resistor.close())
  }

  setQueue({ redisUrl }) {
    const createQueue = (resistorName) => {
      this.queueList.push({
        name: this.getQueueName(resistorName),
        url: redisUrl,
        hostId: this.name
      })
      debug(`create queue ${this.getQueueName(resistorName)}`)
      return new Queue(`${this.getQueueName(resistorName)}`, redisUrl)
    }
    this.powerSource.setupQueue({ createQueue })
    this.resistors.forEach(resistor => resistor.setupQueue({ createQueue, redlock: this.redlock }))
  }

  async cleanQueue(queueRetention) {
    return Promise.each(this.resistors, async (rs) => {
      return rs.cleanQueue(queueRetention)
    })
  }

  // Listen to all resistor queue
  listen({ doneQueue } = {}) {
    debug(`cb:${this.name} is listening.`)
    this.doneQueue = doneQueue
    this.powerSource.listen(
      // complete
      async (discharge, electrons, next) => {
        // check abort before start resistor flow
        const dischargeObj = await this.DischargeModel.findOne({ _id: discharge._id })
        if (dischargeObj.status === 'aborted') {
          return true
        }
        this.initAndPushElectrons(discharge, electrons, next)
      },
      (discharge, error) => {
        // Do something to reset this process
        debug(`circuitBoard listen error: ${error.stack}`)
        return this.doneQueue.add({ dischargeId: discharge._id })
      }
    )
    // listen all resistor queue and pass function which decide what to do next
    this.resistors.forEach(resistor =>
      resistor.listen(
        // complete
        async (electron, nexts) => {
          // check abort before push to next resistor
          if (electron.abort) {
            await this.stat.update(electron.dischargeId, electron._id, 'aborted')
            return true
          }
          await resistor.stat.update(electron.dischargeId, electron._id, 'complete')
          return this.checkAndPushElectron(electron, nexts)
        },
        // failed
        async (electron, error) => {
          // save failed id to resistor
          await resistor.stat.update(electron.dischargeId, electron._id, 'failed')
           // save failed id to cb
          await this.stat.update(electron.dischargeId, electron._id, resistorConstants.RESISTOR_OUTPUT_STATUS.FAILED)
          return this.checkDischargeIsDone(electron.dischargeId)
        }
      )
    )
  }

  usePowerSource(powerSource) {
    this.powerSource = powerSource
  }

  addResistor(resistor) {
    resistor.setParentName(this.name)
    this.resistors.push(resistor)
  }

  // shortcut for single task resistor
  initSingleTaskWithResistor(resistor) {
    this.usePowerSource(new PowerSource({
      next: resistor.name
    }))
    this.addResistor(resistor)
  }

  static checkResistorDependencies(resistor, allResistors) {
    const output = {
      status: true,
      errors: []
    }
    if (resistor.next === 'ground') return output

    const nexts = Array.isArray(resistor.next) ? resistor.next : [resistor.next]
    for (const nextResistorName of nexts) {
      const nextResistor = allResistors.find(res => res.name === nextResistorName)
      if (!nextResistor) output.errors.push(new Error(`Resistor '${nextResistorName}' is missing.`))
      else {
        // recursive call
        const result = CircuitBoard.checkResistorDependencies(nextResistor, allResistors)
        if (!result.status) {
          output.errors = [...output.errors, ...result.errors]
        }
      }
    }
    if (output.errors.length > 0) output.status = false
    return output
  }

  checkAllDependencies() {
    if (!this.powerSource) return new Error('No PowerSource')
    if (this.resistors.length === 0) return new Error('No Resistor')
    if (!this.resistors.find(res => res.next === 'ground')) return new Error('No Resistor connect to ground.')
    // find first task
    return CircuitBoard.checkResistorDependencies(this.powerSource, this.resistors)
  }


  isElectronComplete(electron) {
    if (electron.markedAsComplete) return true
    return this.resistors.every((resistor) => {
      const output = electron.resistorOutput[resistor.name] || {}
      return output.status === resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE
    })
  }

  // complete electron flow (include markedAsComplete flow)
  async ground(electron) {
    debug(`ground e:${electron._id}`)
    // Update electron status
    if (this.isElectronComplete(electron)) {
      await this.stat.update(electron.dischargeId, electron._id, 'complete')
      if (electron.markedAsComplete) {
        await this.stat.update(electron.dischargeId, electron._id, 'markedAsComplete')
      }
    }

    return this.checkDischargeIsDone(electron.dischargeId)
  }

  async checkDischargeIsDone(dischargeId) {
    // Update discharge status if complete
    const stats = await this.stat.getSummary(dischargeId)
    // - decide discharge is complete or not
    debug(`check d:stats: completeThreshold: ${this.completeThreshold} condition: ${stats.isAllDone && stats.completeRatio > this.completeThreshold}`, stats)
    if (stats.isAllDone) {
      let status
      if (stats.completeRatio >= this.completeThreshold) {
        status = resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE
      // if complete ratio below threshold => failed
      } else {
        status = resistorConstants.RESISTOR_OUTPUT_STATUS.FAILED
      }
      debug(`${status} d:${dischargeId}`)
      await this.DischargeModel.update({ _id: dischargeId }, { status })
      return this.doneQueue.add({ dischargeId })
    }
    return false
  }

  getResistorByName(name) {
    return this.resistors.find((resistor) => {
      return resistor.name === name
    })
  }

  isElectronReadyToPush(electron, resistorName) {
    const resistor = this.getResistorByName(resistorName)
    if (!resistor) throw new Error(`Resistor '${resistorName}' is not found`)
    let isReady = true
    // check if next dependency resistor need to wait for any other resistor
    if (resistor.dependencies) {
      // electron has all resistorOuput of dependencies in electron
      isReady =
        resistor.dependencies.every(dependencyName =>
          _.get(electron, `resistorOutput.${dependencyName}.status`, null)
            === resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE)
    }
    return isReady
  }

  handshake(electronId, resistorName, replyId) {
    const r = this.getResistorByName(resistorName)
    if (!r) {
      throw new Error(`resistor ${resistorName} is not found`)
    }
    r.pushReply({ electronId, replyId })
    debug(`add e:${electronId}:reply to r:${resistorName} rep:${replyId}`)
  }

  async pushElectron(electron, resistorName) {
    const r = this.getResistorByName(resistorName)
    if (!r) {
      throw new Error(`resistor ${resistorName} is not found`)
    }
    debug(`get resistor ${r.name}`)
    r.stat.update(electron.dischargeId, electron._id, 'pushed')
    // remove output for performance
    delete electron.resistorOutput
    r.push(electron)
    debug(`add e:${electron._id} to r:${resistorName}`)
  }

  // check dependency before charge electron to resistor
  async checkAndPushElectron(_electron, nexts) {
    // get updated electron
    const electron = await this.ElectronModel.findOne({ _id: _electron._id }).lean()
    if (!electron) throw new Error(`Electron "${_electron._id}" is not found`)
    if (electron.markedAsComplete) {
      // skip all the way to ground
      await this.updateSkipStat(electron, nexts)
      return this.ground(electron)
    }
    nexts.forEach(async (resistorName) => {
      if (resistorName === 'ground') return this.ground(electron)

      const ready = this.isElectronReadyToPush(electron, resistorName)
      if (ready) this.pushElectron(electron, resistorName)
    })
  }

  async updateSkipStat(electron, nexts) {
    return Promise.each(nexts, async (name) => {
      if (name === 'ground') return false
      const resistor = this.getResistorByName(name)
      await resistor.stat.update(electron.dischargeId, electron._id, 'skipped')
      return this.updateSkipStat(electron, resistor.next)
    })
  }

  async discharge({ parentId, payload, opts } = {}) {
    // create Discharge
    debug('typeof payload', typeof payload)
    const dischargeObj = new this.DischargeModel({
      boardName: this.name,
      parentId,
      payload,
      opts
    })
    await dischargeObj.save()
    debug(`'${this.name}' discharge d:${dischargeObj._id}`, payload)
    // TODO: push to powerSource queue
    this.powerSource.push(dischargeObj)
    return dischargeObj
  }

  async abort(_id) {
    const dischargeObj = await this.DischargeModel.findOne({
      _id
    })
    dischargeObj.status = 'aborted'
    await dischargeObj.save()
    return this.ElectronModel.updateMany({ dischargeId: dischargeObj._id }, { $set: { abort: true } })
  }

  async retryDischarge(dischargeId, { type }) {
    const next = this.powerSource.next
    const dischargeObj = await this.DischargeModel.findOne({ _id: dischargeId })
    await this.DischargeModel.updateRetry(dischargeObj, { type })
    // check if powersource failed retry power source
    if (dischargeObj.powerSource.status === 'failed') {
      this.powerSource.push(dischargeObj)
      return dischargeObj
    }

    let electronIds = await this.stat.getMember(dischargeId, 'failed')
    electronIds = electronIds.map(eId => mongoose.Types.ObjectId(eId))
    await this.ElectronModel.update({ _id: { $in: electronIds } }, { $unset: { retry: '' } }, { multi: true })
    const electrons = await this.ElectronModel.find({ _id: { $in: electronIds } }).lean()
    await Promise.each(electrons, async (electron) => {
      await this.stat.removeMember(dischargeId, 'failed', electron._id)
      return this.pushElectron(electron, next)
    })
    dischargeObj.status = 'active'
    return dischargeObj.save()
  }

  async initAndPushElectrons(discharge, electrons, next) {
    await this.stat.init(discharge._id, electrons.length)
    this.resistors.forEach(resistor => resistor.stat.init(discharge._id, electrons.length))
    debug(`starting pushing ${electrons.length} electrons`)
    electrons.forEach((electron) => {
      this.pushElectron(electron, next)
    })
  }
}

module.exports = CircuitBoard
