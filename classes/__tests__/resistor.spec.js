const _ = require('lodash')
const MockDate = require('mockdate')
const Resistor = require('../resistor')
const resistorConstants = require('../../constants/resistor')

describe('Resistor', () => {
  describe('#constructor', () => {
    test('should throw when type is invalid', () => {
      const fn = () => {
        const rs = new Resistor({ type: 'async' })
      }
      expect(fn).toThrow(/unrecognized/)
    })
    test('should throw when type is handshake but dont have replyHandler', () => {
      const fn = () => {
        const rs = new Resistor({ type: 'handshake' })
      }
      expect(fn).toThrow(/replyHandler is required/)
    })
    test('should have null value for dependencies and next if not set', () => {
      const rs = new Resistor()
      expect(rs.dependencies).toBeNull()
      expect(rs.next).toBeNull()
    })
    test('should have default value for dependencies and next if string', () => {
      const rs = new Resistor({
        dependencies: 'rs2',
        next: 'rs3',
        type: 'normal'
      })
      expect(rs.dependencies).toEqual(['rs2'])
      expect(rs.next).toEqual(['rs3'])
    })
  })


  describe('#createQueue', () => {
    test('should set self queue', () => {
      const rs = new Resistor({ name: 'rs1' })
      const expectedQueue = { q: 1, on: jest.fn() }
      const createQueue = jest.fn(() => (expectedQueue))
      rs.setupQueue({ createQueue })
      expect(createQueue).toHaveBeenCalledWith(`resistor:rs1`, undefined)
      expect(rs.queue).toEqual(expectedQueue)
    })
    test('should create ReplyQueue if handshake', () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: () => {}
      })
      const expectedQueue = { q: 1, on: jest.fn() }
      const createQueue = jest.fn(() => (expectedQueue))
      rs.setupQueue({ createQueue })
      expect(createQueue.mock.calls[0]).toEqual([`resistor:rs1`, undefined])
      expect(rs.queue).toEqual(expectedQueue)
      expect(createQueue.mock.calls[1]).toEqual([`resistor:rs1:reply`])
      expect(rs.queue).toEqual(expectedQueue)
    })
  })

  describe('#close', () => {
    test('should close connection', async () => {
      const rs = new Resistor({})
      const expectedQueue = {
        q: 1,
        on: jest.fn(),
        close: jest.fn(async () => {})
      }
      const createQueue = jest.fn(() => (expectedQueue))
      rs.setupQueue({ createQueue })
      rs.stat = {
        close: jest.fn()
      }
      await rs.close()
      expect(expectedQueue.close).toHaveBeenCalled()
      expect(rs.stat.close).toHaveBeenCalled()
    })
  })

  describe('#isHandshake', () => {
    test('should return true when type is handshake', () => {
      const rs = new Resistor({
        type: 'handshake',
        replyHandler: () => {}
      })
      expect(rs.isHandshake()).toBeTruthy()
    })
    test('should return true when type is handshake', () => {
      const rs = new Resistor()
      expect(rs.isHandshake()).toBeFalsy()
    })
  })


  describe('#updateRetry', () => {
    const mockUpdate = (rs) => {
      rs.ElectronModel = {
        update: jest.fn()
      }
    }
    test('should update electron', async () => {
      const electron = { _id: 'e1' }
      const r = new Resistor({
        name: 'rs1'
      })
      mockUpdate(r)
      await r.updateRetry(electron)
      expect(r.ElectronModel.update).toHaveBeenCalledWith(
        { _id: electron._id }, {
        $inc: {
          'retry.rs1': 1
        }
      })
    })
  })


  describe('#shouldRetry', () => {
    test('should return true when retryCount < retryLimit', () => {
      const electron = {}
      const r = new Resistor({
        retryLimit: 2
      })
      expect(r.shouldRetry(electron)).toBeTruthy()
    })
    test('should return false when retryCount >= retryLimit', () => {
      const electron = {
        retry: { r1: 1 }
      }
      const r = new Resistor({
        name: 'r1',
        retryLimit: 1
      })
      expect(r.shouldRetry(electron)).toBeFalsy()
    })
  })


  describe('#retryIfAvailable', () => {
    const mockResistor = (r) => {
      r.shouldRetry = jest.fn(() => false)
      r.updateRetry = jest.fn(async () => false)
      r.updateResistorOutput = jest.fn(() => false)
    }

    test('should do nothing if shouldRetry return false', () => {
      const job = {
        retry: jest.fn()
      }
      const r = new Resistor()
      mockResistor(r)
      r.shouldRetry = jest.fn(() => false)
      r.retryIfAvailable(job, {})
      expect(r.updateRetry).not.toHaveBeenCalled()
      expect(job.retry).not.toHaveBeenCalled()
      expect(r.updateResistorOutput).toHaveBeenCalled()
    })

    test('should update retryCount and rerun job', () => {
      const job = {
        retry: jest.fn()
      }
      const electron = {
        _id: 'e1'
      }
      const r = new Resistor({ retryDelay: 500})
      mockResistor(r)
      r.shouldRetry = jest.fn(() => true)
      r.retryIfAvailable(job, electron)
      setTimeout(() => {
        expect(r.updateRetry).toHaveBeenCalledWith(electron)
        expect(job.retry).toHaveBeenCalled()
      }, 505)
    })

    test('should not call retry before retryDelay', () => {
      const job = {
        retry: jest.fn()
      }
      const electron = {
        _id: 'e1'
      }
      const r = new Resistor({ retryDelay: 500 })
      mockResistor(r)
      r.shouldRetry = jest.fn(() => true)
      r.retryIfAvailable(job, electron)
      setTimeout(() => {
        expect(r.updateRetry).not.toHaveBeenCalledWith()
        expect(job.retry).not.toHaveBeenCalled()
      }, 400)
    })
  })


  describe('#run', () => {
    beforeAll(() => MockDate.set(new Date('1/1/2018')))
    afterAll(() => MockDate.reset())
    const mockUpdate = (rs) => {
      rs.ElectronModel = {
        update: jest.fn()
      }
      rs.updateResistorOutput = jest.fn(() => true)
    }
    test('should call consume function and update electron', async () => {
      const electron = {
        _id: 'e1'
      }
      const output = { output: '1' }
      const rs = new Resistor({
        name: 'rs1',
        consume: jest.fn(() => (output)),
      })
      mockUpdate(rs)
      await rs.run(electron)
      expect(rs.consume.mock.calls[0][0]).toEqual(electron)
      expect(rs.updateResistorOutput)
        .toHaveBeenCalledWith(
          electron._id,
          {
            value: {
              data: output,
              status: resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE,
              timestamp: new Date('1/1/2018')
            }
          }
        )
    })
  })


  describe('#doneProcess', () => {
    const testElectron = { _id: 'e1' }
    const mockResistor = (rs) => {
      rs.queryElectronData = jest.fn(() => testElectron)
      rs.nextFunc = jest.fn()
    }
    test('should call nextFn if not handshake', async () => {
      const rs = new Resistor({
        name: 'rs1',
        next: 'rs2'
      })
      mockResistor(rs)
      await rs.doneProcess(testElectron)
      expect(rs.nextFunc).toHaveBeenCalledWith(testElectron, rs.next)
    })

    test('should call nextFn if handshake and electron is markedAsComplete', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(),
        next: 'rs2'
      })
      const markedElectron = { _id: 'e2', markedAsComplete: true }
      mockResistor(rs)
      rs.queryElectronData = jest.fn(() => markedElectron)
      await rs.doneProcess(testElectron)
      expect(rs.nextFunc).toHaveBeenCalledWith(markedElectron)
    })

    test('should return false if handshake and electron is not markedAsComplete', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(),
        next: 'rs2'
      })
      const unmarkedElectron = { _id: 'e2' }
      mockResistor(rs)
      rs.queryElectronData = jest.fn(() => unmarkedElectron)
      const result = await rs.doneProcess(testElectron)
      expect(rs.nextFunc).not.toHaveBeenCalled()
      expect(result).toBeFalsy()
    })
  })


  describe('#listen', () => {
    const nextFn = jest.fn()
    const failedFn = jest.fn()
    const testElectron = { _id: 'e1', dischargeId: 'd1' }
    const mockResistor = (rs) => {
      rs._queue = {}
      rs._replyQueue = {}
      rs.queue = {
        on: jest.fn((status, cb) => {
          if (status === 'failed') {
            rs._failedCb = cb
          }
        }),
        process: jest.fn((cb) => {
          rs._queue.cb = cb
        }),
        trigger: async (job) => {
          try {
            await rs._queue.cb(job)
          } catch (e) {
            await rs._failedCb(job, e)
          }
        }
      }
      rs.replyQueue = {
        process: jest.fn((cb) => {
          rs._replyQueue.cb = cb
        }),
        trigger: async (job, done) => {
          return rs._replyQueue.cb(job, done)
        }
      }
      rs.doneProcess = jest.fn()
      rs.run = jest.fn(e => rs.consume(e))
      rs.queryElectronData = jest.fn(() => testElectron)
      rs.retryIfAvailable = jest.fn()
      rs.ElectronModel = {
        updateOne: jest.fn((() => rs.ElectronModel)),
        exec: jest.fn()
      }
      rs.stat = {
        update: jest.fn()
      }
    }

    afterEach(() => {
      nextFn.mockClear()
      failedFn.mockClear()
    })

    test('should register fn and listenReply if type is handshake', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(),
        consume: jest.fn()
      })
      mockResistor(rs)
      rs.listenReply = jest.fn()
      rs.listen(nextFn, failedFn)

      expect(rs.queue.process).toHaveBeenCalled()
      expect(rs.listenReply).toHaveBeenCalledWith(nextFn, failedFn)
      rs.handshakeTimeoutCleaner.cancel()
    })

    test('should register function to queue and trigger when  job is coming', async () => {
      const rs = new Resistor({
        name: 'rs1',
        consume: jest.fn()
      })
      mockResistor(rs)
      rs.listen(nextFn, failedFn)

      const job = { data: testElectron }
      await rs.queue.trigger(job)
      expect(rs.queryElectronData).toHaveBeenCalledWith(job.data._id)
      expect(rs.stat.update).toHaveBeenCalledWith(testElectron.dischargeId, testElectron._id, 'consumed')
      expect(rs.run).toHaveBeenCalledWith(testElectron)
      expect(rs.doneProcess).toHaveBeenCalledWith(testElectron)
    })

    test('should failed when electron is not found', async () => {
      const rs = new Resistor({
        name: 'rs1',
        consume: jest.fn(),
      })
      mockResistor(rs)
      rs.queryElectronData = jest.fn()
      rs.retryIfAvailable = jest.fn(() => false)
      rs.listen(nextFn, failedFn)

      const job = { data: { _id: 'jobId' } }
      const expectedError = new Error('Electron:jobId is missing.')
      await rs.queue.trigger(job)
      expect(rs.doneProcess).not.toHaveBeenCalledWith()
      expect(failedFn).toHaveBeenCalledWith(undefined, expectedError)
      expect(rs.retryIfAvailable).toHaveBeenCalledWith(job, undefined)
    })

    test('should provide error to queue and call failed callback when failed', async () => {
      const expectedError = new Error('gg')
      const rs = new Resistor({
        name: 'rs1',
        consume: jest.fn(() => {
          throw expectedError
        })
      })
      mockResistor(rs)
      rs.retryIfAvailable = jest.fn(() => false)
      rs.listen(nextFn, failedFn)

      const job = { data: { _id: 'jobId' } }
      await rs.queue.trigger(job)

      expect(rs.doneProcess).not.toHaveBeenCalled()
      expect(failedFn).toHaveBeenCalledWith(testElectron, expectedError)
      expect(rs.retryIfAvailable).toHaveBeenCalledWith(job, testElectron)
    })

    test('should call doneProcess when complete', async () => {
      const expectedError = new Error('gg')
      const rs = new Resistor({
        name: 'rs1',
        consume: jest.fn(),
        next: 'rs2'
      })
      mockResistor(rs)
      rs.listen(nextFn, failedFn)

      const job = { data: { _id: 'jobId' } }
      await rs.queue.trigger(job)

      expect(rs.doneProcess).toHaveBeenCalledWith(testElectron)
      expect(rs.retryIfAvailable).not.toHaveBeenCalled()
      expect(failedFn).not.toHaveBeenCalled()
    })

    /// TODO: move to handshake test
    // test('should call done() but dont call next callback if type is handshake when complete', async () => {
    //   const expectedError = new Error('gg')
    //   const rs = new Resistor({
    //     name: 'rs1',
    //     consume: jest.fn(),
    //     next: 'rs2',
    //     type: 'handshake',
    //     replyHandler: () => {}
    //   })
    //   mockResistor(rs)
    //   rs.listen(nextFn, failedFn)

    //   const job = { data: { _id: 'jobId' } }
    //   await rs.queue.trigger(job, doneFn)

    //   expect(doneFn).toHaveBeenCalled()
    //   expect(nextFn).not.toHaveBeenCalled()
    //   expect(failedFn).not.toHaveBeenCalled()
    // })

    // test('should call done() and next callback if type is handshake and electron is market completed', async () => {
    //   const rs = new Resistor({
    //     name: 'rs1',
    //     consume: jest.fn(),
    //     next: 'rs2',
    //     type: 'handshake',
    //     replyHandler: () => {}
    //   })
    //   mockResistor(rs)
    //   const markedCompletedElectron = _.cloneDeep(testElectron)
    //   markedCompletedElectron.markedAsComplete = true
    //   rs.queryElectronData = jest.fn(() => markedCompletedElectron)
    //   rs.listen(nextFn, failedFn)

    //   const job = { data: { _id: 'jobId' } }
    //   await rs.queue.trigger(job, doneFn)

    //   expect(doneFn).toHaveBeenCalled()
    //   expect(nextFn).toHaveBeenCalledWith(markedCompletedElectron)
    //   expect(failedFn).not.toHaveBeenCalled()
    // })
  })


  describe('#pushReply', () => {
    test('should throw if call with normal resistor', async () => {
      const rs = new Resistor({
        name: 'rs1',
        replyHandler: jest.fn(() => (output))
      })
      const fn = async () => {
        return rs.pushReply({})
      }
      await expect(fn()).rejects.toEqual(new Error('pushReply must use with handshake type'))
    })

    test('should add data to replyQueue', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(() => (output))
      })
      rs.replyQueue = {
        add: jest.fn()
      }
      const electronId = 'e1'
      const replyId = 'rId'
      await rs.pushReply({ electronId, replyId })
      expect(rs.replyQueue.add).toHaveBeenCalledWith({ electronId, replyId })
    })
  })


  describe('#runReplyHandler', () => {
    beforeAll(() => MockDate.set(new Date('1/1/2018')))
    afterAll(() => MockDate.reset())
    const mockUpdate = (rs) => {
      rs.ElectronModel = {
        update: jest.fn()
      }
      rs.updateResistorOutput = jest.fn(() => true)
    }
    test('should call replyHandler function and update electron', async () => {
      const electron = {
        _id: 'e1'
      }
      const replyData = { op: 'op' }
      const output = { output: '1' }
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(() => (output))
      })
      mockUpdate(rs)
      await rs.runReplyHandler(electron, replyData)
      expect(rs.replyHandler.mock.calls[0][0]).toEqual(electron)
      expect(rs.replyHandler.mock.calls[0][1]).toEqual(replyData)
      expect(rs.updateResistorOutput)
        .toHaveBeenCalledWith(
          electron._id,
          {
            value: {
              data: output,
              status: 'complete',
              timestamp: new Date('1/1/2018')
            }
          }
        )
    })
  })


  describe('#listenReply', () => {
    const nextFn = jest.fn()
    const failedFn = jest.fn()
    const testElectron = { _id: 'e1' }
    const testReply = { rId: 'r1' }
    const mockResistor = (rs) => {
      rs._replyQueue = {}
      rs.replyQueue = {
        on: jest.fn((status, cb) => {
          if (status === 'failed') {
            rs._failedCb = cb
          }
        }),
        process: jest.fn((cb) => {
          rs._replyQueue.cb = cb
        }),
        trigger: async (job) => {
          try {
            await rs._replyQueue.cb(job)
          } catch (e) {
          }
        }
      }
      rs.runReplyHandler = jest.fn((e, data) => rs.replyHandler(e, data))
      rs.queryElectronData = jest.fn(() => testElectron)
      rs.queryReplyData = jest.fn(() => testReply)
      rs.retryIfAvailable = jest.fn()
    }

    afterEach(() => {
      nextFn.mockClear()
      failedFn.mockClear()
    })


    test('should register function to queue and trigger when  job is coming', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(),
        next: 'aaaa'
      })
      mockResistor(rs)
      rs.listenReply(jest.fn(), jest.fn())

      const job = { data: { electronId: 'eId', replyId: 'rId' } }
      await rs.replyQueue.trigger(job)
      expect(rs.queryElectronData).toHaveBeenCalledWith(job.data.electronId)
      expect(rs.queryReplyData).toHaveBeenCalledWith(job.data.replyId)
      expect(rs.runReplyHandler).toHaveBeenCalledWith(testElectron, testReply)
    })


    test('should failed when electron is not found', async () => {
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn()
      })
      mockResistor(rs)
      rs.queryElectronData = jest.fn()
      rs.retryIfAvailable = jest.fn(() => false)
      rs.listenReply(nextFn, failedFn)

      const job = { data: { electronId: 'jobId' } }
      const expectedError = new Error(`Electron:jobId is missing.`)
      await rs.replyQueue.trigger(job)

      expect(failedFn).toHaveBeenCalledWith(undefined, expectedError)
      expect(rs.retryIfAvailable).toHaveBeenCalledWith(job, undefined)
      expect(nextFn).not.toHaveBeenCalled()
    })

    test('should provide error to queue and call failed callback when failed', async () => {
      const expectedError = new Error('gg')
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(() => {
          throw expectedError
        })
      })
      mockResistor(rs)
      rs.retryIfAvailable = jest.fn(() => false)
      rs.listenReply(nextFn, failedFn)

      const job = { data: { electronId: 'jobId', replyId: 'rId' } }
      await rs.replyQueue.trigger(job)

      expect(failedFn).toHaveBeenCalledWith(testElectron, expectedError)
      expect(rs.retryIfAvailable).toHaveBeenCalledWith(job, testElectron)
      expect(nextFn).not.toHaveBeenCalled()
    })

    test('should call next callback when complete', async () => {
      const expectedError = new Error('gg')
      const rs = new Resistor({
        name: 'rs1',
        type: 'handshake',
        replyHandler: jest.fn(),
        next: 'rs2'
      })
      mockResistor(rs)
      rs.listenReply(nextFn, failedFn)

      const job = { data: { electronId: 'jobId', replyId: 'rId' } }
      await rs.replyQueue.trigger(job)

      expect(nextFn).toHaveBeenCalledWith(testElectron, rs.next)
      expect(rs.retryIfAvailable).not.toHaveBeenCalled()
      expect(failedFn).not.toHaveBeenCalled()
    })
  })
})
