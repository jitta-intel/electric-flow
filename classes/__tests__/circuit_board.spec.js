const redis = require('ioredis')
const CircuitBoard = require('../circuit_board')
const Resistor = require('../resistor')
const resistorConstants = require('../../constants/resistor')

describe('CircuitBoard', () => {
  describe('.checkResistorDependencies', () => {
    beforeAll(() => {
      jest.spyOn(CircuitBoard, 'checkResistorDependencies')
    })
    afterEach(() => {
      CircuitBoard.checkResistorDependencies.mockClear()
    })

    test('should return valid result when resistor connect to ground', () => {
      const testResistor = {
        next: 'ground'
      }
      const result = CircuitBoard.checkResistorDependencies(testResistor, [])
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ status: true, errors: [] })
    })

    test('should return valid result when resistor has linear connection', () => {
      const testResistor = {
        name: 'rs0',
        next: 'rs1'
      }
      const resistors = [
        { name: 'rs1', next: 'rs2' },
        { name: 'rs2', next: 'ground' }
      ]
      const result = CircuitBoard.checkResistorDependencies(testResistor, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledTimes(3)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs0', next: 'rs1' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs1', next: 'rs2' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs2', next: 'ground' }, resistors)
      expect(result).toEqual({ status: true, errors: [] })
    })

    test('should return valid result when resistor has split connection', () => {
      const testResistor = {
        name: 'rs0',
        next: 'rs1'
      }
      const resistors = [
        { name: 'rs1', next: ['rs2', 'rs3'] },
        { name: 'rs2', next: 'ground' },
        { name: 'rs3', next: 'ground' }
      ]
      const result = CircuitBoard.checkResistorDependencies(testResistor, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledTimes(4)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs0', next: 'rs1' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs1', next: ['rs2', 'rs3'] }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs2', next: 'ground' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs3', next: 'ground' }, resistors)
      expect(result).toEqual({ status: true, errors: [] })
    })

    test('should return valid result when resistor has split connection', () => {
      const testResistor = {
        name: 'rs0',
        next: 'rs1'
      }
      const resistors = [
        { name: 'rs1', next: ['rs2', 'rs3'] },
        { name: 'rs2', next: 'ground' },
        { name: 'rs3', next: 'rs4' },
        { name: 'rs4', next: 'ground' }
      ]
      const result = CircuitBoard.checkResistorDependencies(testResistor, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledTimes(5)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs0', next: 'rs1' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs1', next: ['rs2', 'rs3'] }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs2', next: 'ground' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs3', next: 'rs4' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs4', next: 'ground' }, resistors)
      expect(result).toEqual({ status: true, errors: [] })
    })

    test('should return error when resistor has missing connection', () => {
      const testResistor = {
        name: 'rs0',
        next: 'rs1'
      }
      const resistors = [
        { name: 'rs1', next: ['rs2', 'rs3'] },
        { name: 'rs2', next: 'ground' },
        { name: 'rs3', next: 'rs5' },
        { name: 'rs4', next: 'ground' }
      ]
      const result = CircuitBoard.checkResistorDependencies(testResistor, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledTimes(4)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs0', next: 'rs1' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs1', next: ['rs2', 'rs3'] }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs2', next: 'ground' }, resistors)
      expect(CircuitBoard.checkResistorDependencies).toHaveBeenCalledWith({ name: 'rs3', next: 'rs5' }, resistors)
      expect(result).toEqual({ status: false, errors: [
        new Error(`Resistor 'rs5' is missing.`)
      ]})
    })
  })


  describe('#initSingleTaskWithResistor', () => {
    test('should add resistor with single task powersource', () => {
      const cb = new CircuitBoard({
        name: 'test'
      })

      const resistor = new Resistor({
        name: 'rs1',
        next: 'ground'
      })
      cb.initSingleTaskWithResistor(resistor)

      expect(cb.powerSource).toHaveProperty('next', resistor.name)
      expect(cb.resistors).toHaveLength(1)
      expect(cb.resistors[0]).toEqual(resistor)
    })
  })


  describe('#checkAllDependencies', () => {
    beforeAll(() => {
      jest.spyOn(CircuitBoard, 'checkResistorDependencies')
    })
    afterEach(() => {
      CircuitBoard.checkResistorDependencies.mockClear()
    })

    test('should return error when no powersource in board', () => {
      const cb = new CircuitBoard('test')
      expect(cb.checkAllDependencies()).toEqual(new Error('No PowerSource'))
    })

    test('should return error when no resistors in board', () => {
      const cb = new CircuitBoard('test')
      cb.usePowerSource({ name: 'ps' })
      expect(cb.checkAllDependencies()).toEqual(new Error('No Resistor'))
    })

    test('should return error when no resistors connecting to ground', () => {
      const cb = new CircuitBoard('test')
      cb.usePowerSource({ name: 'ps' })
      cb.addResistor({
        name: 'rs1',
        next: 'rs2',
        setParentName: jest.fn()
      })
      expect(cb.checkAllDependencies()).toEqual(new Error('No Resistor connect to ground.'))
    })
  })


  describe('#listen', () => {
    test('should listen powerSource queue and all resistor queue', () => {
      const circuitBoard = new CircuitBoard('test')
      circuitBoard.powerSource = {
        listen: jest.fn()
      }
      circuitBoard.resistors = [
        { name: 'rs1', listen: jest.fn() },
        { name: 'rs2', listen: jest.fn() },
      ]
      circuitBoard.listen()
      expect(circuitBoard.powerSource.listen).toHaveBeenCalled()
      expect(circuitBoard.resistors[0].listen).toHaveBeenCalled()
      expect(circuitBoard.resistors[1].listen).toHaveBeenCalled()
    })
  })


  describe('#isElectronReadyToPush', () => {
    const circuitBoard = new CircuitBoard('test')
    circuitBoard.resistors = [
      { name: 'rs1', next: ['rs2', 'rs3'] },
      { name: 'rs2', next: 'rs4', dependencies: ['rs1'] },
      { name: 'rs3', next: 'rs4' },
      { name: 'rs4', next: 'ground', dependencies: ['r2', 'r3'] }
    ]
    test('should throw error true when resistor is not found', () => {
      const electron = { _id: 'e1' }
      const func = () => {
        circuitBoard.isElectronReadyToPush(electron, 'rs0')
      }
      expect(func).toThrowError('not found')
    })

    test('should return true when resistor has no dependency', () => {
      const electron = { _id: 'e1' }
      expect(circuitBoard.isElectronReadyToPush(electron, 'rs1')).toBeTruthy()
    })

    test('should return true when electron dont have dependencies output', () => {
      const electron = { _id: 'e1' }
      expect(circuitBoard.isElectronReadyToPush(electron, 'rs3')).toBeTruthy()
    })

    test('should return false when resistor has dependencies and one of output is not complete', () => {
      const electron = {
        _id: 'e1',
        resistorOutput: {
          r2: {},
          r3: {
            status: resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE
          }
        }
      }
      expect(circuitBoard.isElectronReadyToPush(electron, 'rs4')).toBeFalsy()
    })

    test('should return true when all dependencies is complete', () => {
      const electron = {
        _id: 'e1',
        resistorOutput: {
          r2: {
            status: resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE
          },
          r3: {
            status: resistorConstants.RESISTOR_OUTPUT_STATUS.COMPLETE
          }
        }
      }
      expect(circuitBoard.isElectronReadyToPush(electron, 'rs4')).toBeTruthy()
    })
  })


  describe('#checkAndPushElectron', () => {
    let circuitBoard
    const mockElectron = (cb, electron) => {
      cb.ElectronModel = {
        findOne: () => cb.ElectronModel,
        lean: async () => {
          if (electron) return Object.assign({}, electron)
          return null
        }
      }
    }
    beforeEach(() => {
      circuitBoard = new CircuitBoard('test')
      circuitBoard.ground = jest.fn()
      jest.spyOn(circuitBoard, 'isElectronReadyToPush')
      jest.spyOn(circuitBoard, 'pushElectron')
      jest.spyOn(circuitBoard, 'updateSkipStat')
      mockElectron(circuitBoard, {
        _id: 'e1'
      })
    })

    test('should throw when electron._id is not exists', async () => {
      mockElectron(circuitBoard, null)
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['rs2']
      }))
      const electron = {
        _id: 'e1',
      }
      const target = ['ground']

      expect(circuitBoard.checkAndPushElectron(electron, target)).rejects.toEqual(new Error('Electron "e1" is not found'))
    })

    test('should call ground when electron is marked as complete, and update skipped all the way till ground', async () => {
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['rs2']
      }))
      const electron = {
        _id: 'e1',
        markedAsComplete: true,
      }
      circuitBoard.updateSkipStat = jest.fn()
      mockElectron(circuitBoard, electron)
      const target = ['rs1']

      await circuitBoard.checkAndPushElectron(electron, target)
      expect(circuitBoard.ground).toHaveBeenCalled()
      expect(circuitBoard.isElectronReadyToPush).not.toHaveBeenCalled()
      expect(circuitBoard.pushElectron).not.toHaveBeenCalled()
      expect(circuitBoard.updateSkipStat).toHaveBeenCalledWith(electron, target)
    })

    test('should call ground when target is ground', async () => {
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['rs2']
      }))
      const electron = {
        _id: 'e1',
      }
      const target = ['ground']

      await circuitBoard.checkAndPushElectron(electron, target)
      expect(circuitBoard.ground).toHaveBeenCalled()
      expect(circuitBoard.isElectronReadyToPush).not.toHaveBeenCalled()
      expect(circuitBoard.pushElectron).not.toHaveBeenCalled()
      expect(circuitBoard.updateSkipStat).not.toHaveBeenCalled()
    })

    test('should not push resistor when electron is not ready', async() => {
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['rs2']
      }))
      const electron = {
        _id: 'e1',
      }
      const target = ['rs1']
      circuitBoard.isElectronReadyToPush.mockImplementation(() => false)

      await circuitBoard.checkAndPushElectron(electron, target)
      expect(circuitBoard.ground).not.toHaveBeenCalled()
      expect(circuitBoard.isElectronReadyToPush).toHaveBeenCalled()
      expect(circuitBoard.pushElectron).not.toHaveBeenCalled()
    })

    test('should push to resistor when electron is ready', async() => {
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['rs2']
      }))
      const electron = {
        _id: 'e1',
      }
      const target = ['rs1']
      circuitBoard.isElectronReadyToPush.mockImplementation(() => true)
      circuitBoard.pushElectron.mockImplementation(() => true)

      await circuitBoard.checkAndPushElectron(electron, target)
      expect(circuitBoard.ground).not.toHaveBeenCalled()
      expect(circuitBoard.isElectronReadyToPush).toHaveBeenCalled()
      expect(circuitBoard.pushElectron).toHaveBeenCalled()
      expect(circuitBoard.pushElectron).toHaveBeenCalledWith(electron, 'rs1')
    })

    test('should push to multiple resistor when electron is ready', async() => {
      circuitBoard.addResistor(new Resistor({
        name: 'rs1',
        next: ['ground']
      }))
      circuitBoard.addResistor(new Resistor({
        name: 'rs2',
        next: ['ground']
      }))
      const electron = {
        _id: 'e1',
      }
      const target = ['rs1', 'rs2']
      circuitBoard.isElectronReadyToPush.mockImplementation(() => true)
      circuitBoard.pushElectron.mockImplementation(() => true)

      await circuitBoard.checkAndPushElectron(electron, target)
      expect(circuitBoard.ground).not.toHaveBeenCalled()
      expect(circuitBoard.isElectronReadyToPush).toHaveBeenCalledTimes(2)
      expect(circuitBoard.pushElectron).toHaveBeenCalledTimes(2)
      expect(circuitBoard.pushElectron).toHaveBeenCalledWith(electron, 'rs1')
      expect(circuitBoard.pushElectron).toHaveBeenCalledWith(electron, 'rs2')
    })
  })

  describe('#updateSkipStat', () => {
    test('should dp nothing if next is ground', async () => {
      const electron = { _id: 'e1' }
      const circuitBoard = new CircuitBoard()
      const r1 ={
        name: 'r1',
        stat: { update: jest.fn() },
        next: ['r2']
      }
      circuitBoard.resistors = [r1]
      circuitBoard.getResistorByName = jest.fn()
      await circuitBoard.updateSkipStat(electron, ['ground'])
      expect(r1.stat.update).not.toHaveBeenCalled()
    })
    test('should recursive update skipped stat until ground', async () => {
      const electron = { _id: 'e1', dischargeId: 'd1' }
      const r1 = {
        name: 'r1',
        stat: { update: jest.fn() },
        next: ['r2']
      }
      const r2 = {
        name: 'r2',
        stat: { update: jest.fn() },
        next: ['r3']
      }
      const r3 = {
        name: 'r3',
        stat: { update: jest.fn() },
        next: ['ground']
      }
      const circuitBoard = new CircuitBoard()
      circuitBoard.resistors = [r1, r2, r3]
      await circuitBoard.updateSkipStat(electron, ['r2'])
      expect(r1.stat.update).not.toHaveBeenCalled()
      expect(r2.stat.update).toHaveBeenCalledWith(electron.dischargeId, electron._id, 'skipped')
      expect(r3.stat.update).toHaveBeenCalledWith(electron.dischargeId, electron._id, 'skipped')
    })
  })

  describe('#isElectronIsComplete', () => {
    test('should return true if electron is markedAsComplete', () => {
      const circuitBoard = new CircuitBoard()
      const e = {
        markedAsComplete: true
      }
      expect(circuitBoard.isElectronComplete(e)).toBeTruthy()
    })
    test('should return false some of output status is not complete', () => {
      const circuitBoard = new CircuitBoard()
      circuitBoard.resistors = [
        { name: 'rs1' },
        { name: 'rs2' }
      ]
      const e = {
        resistorOutput: {
          rs1: { status: 'complete' },
          rs2: { status: 'failed' }
        }
      }
      expect(circuitBoard.isElectronComplete(e)).toBeFalsy()
    })
    test('should return true when all output status is complete', () => {
      const circuitBoard = new CircuitBoard()
      const e = {
        resistorOutput: {
          rs1: { status: 'complete' },
          rs2: { status: 'complete' }
        }
      }
      expect(circuitBoard.isElectronComplete(e)).toBeTruthy()
    })
  })

  describe('#checkDischargeIsDone', () => {
    const doneQueue = {
      add: jest.fn()
    }
    const mockDischargeId = 'e1'
    const mockDischargeModel = (cb) => {
      class DischargeModel {
        async save() {
          this._id = mockDischargeId
          return true
        }
      }
      cb.DischargeModel = DischargeModel
      cb.DischargeModel.updateOne = jest.fn()
    }
    const mockStat = (cb) => {
      cb.stat = {
        getSummary: jest.fn(),
        getMember: jest.fn()
      }
    }

    const mockElectron = (cb, electron) => {
      cb.ElectronModel = {
        find: () => cb.ElectronModel,
        lean: async () => {
          if (electron) return Object.assign({}, electron)
          return null
        }
      }
    }
    const mockFallbackThreshold = jest.fn()
    afterEach(() => {
      doneQueue.add.mockClear()
    })
    test('should return false when discharge is not done', async () => {
      const stats = {
        isAllDone: false
      }
      const circuitBoard = new CircuitBoard('test')
      mockDischargeModel(circuitBoard)
      mockStat(circuitBoard)
      circuitBoard.stat.getSummary = jest.fn(() => (stats))
      circuitBoard.doneQueue = doneQueue

      const result = await circuitBoard.checkDischargeIsDone(mockDischargeId)
      expect(doneQueue.add).not.toHaveBeenCalled()
    })

    test('should update complete status and add doneQueue when completeRatio is higher than threshold', async () => {
      const stats = {
        isAllDone: true,
        completeRatio: 0.6
      }
      const circuitBoard = new CircuitBoard({
        name: 'test',
        completeThreshold: 0.5
      })
      mockDischargeModel(circuitBoard)
      mockStat(circuitBoard)
      circuitBoard.stat.getSummary = jest.fn(async () => (stats))
      circuitBoard.doneQueue = doneQueue

      const result = await circuitBoard.checkDischargeIsDone(mockDischargeId)
      expect(circuitBoard.DischargeModel.updateOne).toHaveBeenCalledWith({ _id: mockDischargeId }, { $set: { status: 'complete', stats } })
      expect(doneQueue.add).toHaveBeenCalledWith({ dischargeId: mockDischargeId })
    })

    test('should update failed status and add doneQueue when completeRatio is higher than threshold', async () => {
      const stats = {
        isAllDone: true,
        completeRatio: 0.4
      }
      const circuitBoard = new CircuitBoard({
        name: 'test',
        completeThreshold: 0.5
      })
      mockDischargeModel(circuitBoard)
      mockStat(circuitBoard)
      circuitBoard.stat.getSummary = jest.fn(() => (stats))
      circuitBoard.doneQueue = doneQueue

      const result = await circuitBoard.checkDischargeIsDone(mockDischargeId)
      expect(circuitBoard.DischargeModel.updateOne).toHaveBeenCalledWith({ _id: mockDischargeId }, { $set: { status: 'failed', stats } })
      expect(doneQueue.add).toHaveBeenCalledWith({ dischargeId: mockDischargeId })
    })

    test('should update failed status and run fallbackCompleteThreshold when completeRatio is less than threshold', async () => {
      const stats = {
        isAllDone: true,
        completeRatio: 0.6
      }
      const circuitBoard = new CircuitBoard({
        name: 'test',
        completeThreshold: 0.8,
        fallbackCompleteThreshold: mockFallbackThreshold
      })
      mockDischargeModel(circuitBoard)
      mockStat(circuitBoard)
      mockElectron(circuitBoard,{
        _id: 'e1'
      })
      circuitBoard.stat.getSummary = jest.fn(() => (stats))
      circuitBoard.doneQueue = doneQueue

      const result = await circuitBoard.checkDischargeIsDone(mockDischargeId)
      expect(circuitBoard.stat.getMember).toHaveBeenCalled()
      expect(circuitBoard.fallbackCompleteThreshold).toHaveBeenCalled()
    })

    test('should update failed status and not run fallbackCompleteThreshold when completeRatio is less than threshold', async () => {
      const stats = {
        isAllDone: true,
        completeRatio: 0.6
      }
      const circuitBoard = new CircuitBoard({
        name: 'test',
        completeThreshold: 0.8,
      })
      mockDischargeModel(circuitBoard)
      mockStat(circuitBoard)
      mockElectron(circuitBoard,{
        _id: 'e1'
      })
      circuitBoard.stat.getSummary = jest.fn(() => (stats))
      circuitBoard.doneQueue = doneQueue

      const result = await circuitBoard.checkDischargeIsDone(mockDischargeId)
      expect(circuitBoard.stat.getMember).not.toHaveBeenCalled()
    })
  })

  describe('#handshake', () => {
    test('should throw when resistor is not found', async () => {
      const circuitBoard = new CircuitBoard('test')
      const r = {
        name: 'rs1',
        next: ['ground'],
        pushReply: jest.fn(),
        setParentName: jest.fn()
      }
      const electronId = 'e1'
      const replyId = 'r1'
      circuitBoard.addResistor(r)
      const fn = async () => {
        return circuitBoard.handshake(electronId, 'rs0', replyId)
      }
      await expect(fn()).rejects.toEqual(new Error('resistor rs0 is not found'))
    })

    test('should push reply to resistor', async () => {
      const circuitBoard = new CircuitBoard('test')
      const r = {
        name: 'rs1',
        next: ['ground'],
        pushReply: jest.fn(),
        setParentName: jest.fn()
      }
      const electronId = 'e1'
      const replyId = 'r1'
      circuitBoard.addResistor(r)
      await circuitBoard.handshake(electronId, r.name, replyId)
      expect(r.pushReply).toHaveBeenCalledWith({ electronId, replyId })
    })
  })


  describe('#discharge', () => {
    const mockDischargeId = 'e1'
    const mockDischargeModel = (cb) => {
      class DischargeModel {
        async save() {
          this._id = mockDischargeId
          return true
        }
      }
      cb.DischargeModel = DischargeModel
    }
    const circuitBoard = new CircuitBoard('test')
    circuitBoard.powerSource = {
      next: 'rs1',
      push: jest.fn()
    }

    beforeAll(() => {
      mockDischargeModel(circuitBoard, {
        _id: mockDischargeId
      })
    })

    test('should save discharge data and push discharge to powersource.queue', async () => {
      const payload = {
        market: 'TH'
      }
      await circuitBoard.discharge({ payload })
      expect(circuitBoard.powerSource.push).toHaveBeenCalledWith({
        _id: mockDischargeId
      })
    })
  })

  describe('#initAndPushElectrons', () => {
    const mockStat = (cb) => {
      cb.stat = {
        init: jest.fn()
      }
    }
    test('should init stat and push all electrons in arrays', async () => {
      const circuitBoard = new CircuitBoard('test')
      mockStat(circuitBoard)
      const d = { _id: 'd1' }
      const es = [{ _id: 'e1' }, { _id: 'e2' }]
      const next = 'rs1'

      circuitBoard.stat.init = jest.fn()
      circuitBoard.pushElectron = jest.fn()

      await circuitBoard.initAndPushElectrons(d, es, next)

      expect(circuitBoard.stat.init).toHaveBeenCalledWith(d._id, es.length)
      expect(circuitBoard.pushElectron).toHaveBeenCalledWith(es[0], next)
      expect(circuitBoard.pushElectron).toHaveBeenCalledWith(es[1], next)
    })
  })

  describe('#setParentName', () => {
    test('should set parent name and connected status', async () => {
      const circuitBoard = new CircuitBoard('test')
      expect(circuitBoard.connected).toBe(false)
      circuitBoard.setParentName('mb1')
      expect(circuitBoard.parentName).toBe('mb1')
      expect(circuitBoard.connected).toBe(true)
    })

    test('should throw error when board is already connected to some mainboard', async () => {
      const circuitBoard = new CircuitBoard('test')
      circuitBoard.connected = true
      const fn = () => circuitBoard.setParentName('mb1')
      expect(fn).toThrowError()
    })
  })
})
