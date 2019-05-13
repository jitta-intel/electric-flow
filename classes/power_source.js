const debug = require('debug')('electrician:power_source')
const NOOP = (payload) => (payload)
class PowerSource {
  constructor({ generate, next } = {}) {
    this.mongooseConnection = null
    this.generate = generate || NOOP
    this.next = next
  }

  setConnection({ mongooseConnection }) {
    // MissingSchemaError will be thrown if model has not been registered
    this.ElectronModel = mongooseConnection.model('Electron')
    this.DischargeModel = mongooseConnection.model('Discharge')
  }

  async generateElectrons({ dischargeId, payload, opts = {} }) {
    let electronData = await this.generate(payload)
    if (!Array.isArray(electronData)) {
      electronData = [electronData]
    }
    let electrons = electronData.map((data) => new this.ElectronModel({
      dischargeId,
      data,
      priority: opts.priority
    }))
    // save all electron to mongodb
    electrons = await this.ElectronModel.insertMany(electrons)
    debug(`created ${electrons.length} electrons.`)
    return electrons
  }

  async start(discharge) {
    if (!this.ElectronModel) {
      throw new Error('mongooseConnection has not been set')
    }
    // generate Electrons
    await this.updateActiveDischarge(discharge)
    const electrons = await this.generateElectrons({ dischargeId: discharge._id, payload: discharge.payload, opts: discharge.opts })
    await this.updateCompleteDischarge(discharge, electrons.length)
    return electrons
  }

  async close() {
    debug(`close powerSource ${this.name}`)
    return this.queue ? this.queue.close() : true
  }

  async setupQueue({ createQueue }) {
    this.queue = createQueue(`power_source`)
  }

  push(discharge) {
    debug('push discharge', discharge)
    this.queue.add(discharge)
  }

  listen(nextFunc, failedFunc) {
    this.queue.process(async (job) => {
      const discharge = job.data
      const electrons = await this.start(discharge)
      debug(`d:${discharge._id} generated ${electrons.length} electrons.`)
      return nextFunc(discharge, electrons, this.next)
    })

    this.queue.on('failed', async (job, error) => {
      console.error(`Power source error d[${job}]`, error)
      const discharge = job.data
      await this.updateFailedDischarge(discharge, error)
      return failedFunc(discharge, error)
    })
  }

  async updateActiveDischarge({ _id }) {
    return this.DischargeModel.update({ _id }, {
      $set: {
        status: 'active',
        powerSource: {
          status: 'active'
        }
      }
    })
  }

  async updateFailedDischarge({ _id }, error = {}) {
    // update discharge status here to reduce 1 query at failedCallback
    return this.DischargeModel.update({ _id }, {
      $set: {
        status: 'failed',
        powerSource: {
          status: 'failed',
          error: error.message,
          stack: error.stack
        }
      }
    })
  }

  async updateCompleteDischarge({ _id }, totalElectrons) {
    return this.DischargeModel.update({ _id }, {
      $set: {
        powerSource: {
          status: 'complete',
          totalElectrons
        }
      }
    })
  }
}

module.exports = PowerSource
