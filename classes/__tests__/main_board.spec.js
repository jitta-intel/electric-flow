const MainBoard = require('../main_board')
const CircuitBoard = require('../circuit_board')


describe('MainBoard', () => {
  describe('#getQueues', () => {
    test('should merge all circuit board q and return',  () => {
      const mb = new MainBoard({ name: 'test' })
      mb.circuitBoards = [
        { queueList: [1, 2, 3]},
        { queueList: [4, 5, 6]},
      ]
      expect(mb.getQueues()).toEqual([1, 2, 3, 4, 5, 6])
    })
  })


  describe('#addCircuitBoard', () => {
    test('should add circuitBoard to array',  () => {
      const mb = new MainBoard({ name: 'test' })
      const cb = new CircuitBoard({ name: 'cb1' })
      mb.addCircuitBoard(cb)
      expect(mb.circuitBoards).toEqual([cb])
    })

    test('should throw if type is not CircuitBoard', () => {
      const mb = new MainBoard({ name: 'test' })
      const fn = () => {
        mb.addCircuitBoard({})
      }
      expect(fn).toThrow(/not CircuitBoard/)
    })
  })


  describe('#listen', () => {
    const cb1 = new CircuitBoard({})
    const cb2 = new CircuitBoard({})
    const cb3 = new CircuitBoard({})
    beforeEach(() => {
      cb1.listen = jest.fn()
      cb2.listen = jest.fn()
      cb3.listen = jest.fn()
    })

    test('should listen all circuitBoard and listen to self doneQueue', () => {
      const mb = new MainBoard({ name: 'test' })
      mb.doneQueue = { queue: 'test', process: jest.fn() }
      mb.circuitBoards = [
        cb1, cb2, cb3
      ]
      mb.listen()
      expect(cb1.listen).toHaveBeenCalledWith({ doneQueue: mb.doneQueue })
      expect(cb2.listen).toHaveBeenCalledWith({ doneQueue: mb.doneQueue })
      expect(cb3.listen).toHaveBeenCalledWith({ doneQueue: mb.doneQueue })
      expect(mb.doneQueue.process).toHaveBeenCalled()
    })
  })

  describe('#abortDischarge', () => {
    const mockMainboard = (mb) => {
      mb.DischargeModel = {
        find: () => mb.DischargeModel,
        lean: jest.fn(),
        updateOne: jest.fn()
      }
      mb.notifySlack = jest.fn()
    }

    test('should abort discharge when no active discharge', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockMainboard(mb)
      const mainDischarge = {
        id: 'md1'
      }
      mb.DischargeModel.findOne = jest.fn(() => mainDischarge)
      mb.isActiveSubDischarge = jest.fn(() => null)
      mb.getCircuitBoardByName = jest.fn()

      const result = await mb.abortDischarge('md1')
      expect(mb.notifySlack).toHaveBeenCalledWith('abort', mainDischarge)
      expect(mb.getCircuitBoardByName).not.toHaveBeenCalled()
      expect(result).toEqual(mainDischarge)
    })

    test('should abort discharge and abort active subDischarge', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockMainboard(mb)
      const mainDischarge = {
        id: 'md1'
      }
      const activeDischarge = {
        _id: 'ad1',
        boardName: 'b1',
      }
      const cb = {
        name: 'b1',
        abort: jest.fn(() => {})
      }
      mb.DischargeModel.findOne = jest.fn(() => mainDischarge)
      mb.isActiveSubDischarge = jest.fn(() => activeDischarge)
      mb.getCircuitBoardByName = jest.fn(() => cb)

      const result = await mb.abortDischarge('md1')
      expect(mb.notifySlack).toHaveBeenCalledWith('abort', mainDischarge)
      expect(mb.getCircuitBoardByName).toHaveBeenCalledWith(activeDischarge.boardName)
      expect(cb.abort).toHaveBeenCalledWith(activeDischarge._id)
      expect(result).toEqual(mainDischarge)
    })
  })

  describe('#doneDischarge', () => {
    const mockMainboard = (mb) => {
      mb.DischargeModel = {
        find: () => mb.DischargeModel,
        lean: jest.fn(),
        updateOne: jest.fn()
      }
      mb.retryIfAvailable = jest.fn()
      mb.findDischarges = jest.fn()
      mb.notifySlack = jest.fn()
    }
    test('should update complete status when all subDischarges are complete', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockMainboard(mb)
      mb.DischargeModel.lean = jest.fn(() => ([
        { status: 'complete', stat: {} },
        { status: 'complete', stat: {} },
        { status: 'complete', stat: {} }
      ]))
      const mainDischarge = { _id: 'pid' }
      mb.findDischarges.mockImplementation(() => [mainDischarge])
      await mb.doneDischarge(mainDischarge._id)
      expect(mb.DischargeModel.updateOne).toHaveBeenCalledWith({ _id: mainDischarge._id }, { status: 'complete' })
      expect(mb.retryIfAvailable).toHaveBeenCalledWith(mainDischarge._id, { type: 'Auto' })
      expect(mb.notifySlack).toHaveBeenCalledWith('done', mainDischarge)
    })

    test('should update failed status when at least one on discharge is failed', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockMainboard(mb)
      mb.DischargeModel.lean = jest.fn(() => ([
        { status: 'complete' },
        { status: 'failed' },
        { status: 'complete' }
      ]))
      const mainDischarge = { _id: 'pid' }
      mb.findDischarges.mockImplementation(() => [mainDischarge])
      await mb.doneDischarge(mainDischarge._id)
      expect(mb.DischargeModel.updateOne).toHaveBeenCalledWith({ _id: mainDischarge._id }, { status: 'failed' })
      expect(mb.retryIfAvailable).toHaveBeenCalledWith(mainDischarge._id, { type: 'Auto' })
      expect(mb.notifySlack).toHaveBeenCalledWith('done', mainDischarge)
    })
  })


  describe('#discharge', () => {
    const mockDischargeId = 'md1'
    const mockDischargeModel = (mb) => {
      class DischargeModel {
        async save() {
          this._id = mockDischargeId
          return true
        }
      }
      mb.DischargeModel = DischargeModel
      mb.notifySlack = jest.fn()
    }

    test('should create main discharge and call dischargeIfReady', async () => {
      const mb = new MainBoard({ name: 'test' })
      mb.isStarted = true
      const payload = { market: 'TH' }
      mb.dischargeIfReady = jest.fn()
      mockDischargeModel(mb)

      await mb.discharge(payload)
      expect(mb.dischargeIfReady).toHaveBeenCalledWith(mockDischargeId)
      expect(mb.notifySlack).toHaveBeenCalledWith('start', { _id: mockDischargeId })
    })

    test('should throw if mainboard havnt started yet', async () => {
      const mb = new MainBoard({ name: 'test' })
      const payload = { market: 'TH' }
      mb.dischargeIfReady = jest.fn()

      await expect(mb.discharge(payload)).rejects.toThrow('haven\'t start')
    })
  })

  describe('#dischargeIfReady', () => {
    const mockDischargeId = 'md1'
    const mockDischargeModel = (mb) => {
      class DischargeModel {
        async save() {
          this._id = mockDischargeId
          return true
        }
      }
      mb.DischargeModel = DischargeModel
      mb.DischargeModel.findOne = jest.fn(async () => ({ _id: mockDischargeId }))
      mb.DischargeModel.findCompleteChildren = jest.fn(async () => {})
      mb.DischargeModel.markChildBoardDischarged = jest.fn(async () => {})
    }

    test('should discharge nothing if all children discharge is complete', async () => {
      const mb = new MainBoard({ name: 'test' })
      mb.isStarted = true
      const b1 = {
        name: 'cb1',
        discharge: jest.fn()
      }
      const b2 = {
        name: 'cb2',
        discharge: jest.fn()
      }
      mb.circuitBoards = [b1, b2]
      mockDischargeModel(mb)
      mb.DischargeModel.findCompleteChildren.mockImplementation(async () => (['cb1', 'cb2']))
      mb.DischargeModel.markChildBoardDischarged.mockImplementation(async () => true)
      await mb.dischargeIfReady(mockDischargeId)
      expect(b1.discharge).not.toHaveBeenCalled()
      expect(b2.discharge).not.toHaveBeenCalled()
    })

    test('should discharge board which no dependency and not complete', async () => {
      const mb = new MainBoard({ name: 'test' })
      mb.isStarted = true
      const b1 = {
        name: 'cb1',
        discharge: jest.fn()
      }
      const b2 = {
        name: 'cb2',
        discharge: jest.fn()
      }
      mb.circuitBoards = [b1, b2]
      mockDischargeModel(mb)
      mb.DischargeModel.findCompleteChildren.mockImplementation(async () => (['cb1']))
      mb.DischargeModel.markChildBoardDischarged.mockImplementation(async () => true)
      await mb.dischargeIfReady(mockDischargeId)
      expect(b1.discharge).not.toHaveBeenCalled()
      expect(b2.discharge).toHaveBeenCalled()
    })

    test('should discharge board with dependency only if dependency is complete', async () => {
      const mb = new MainBoard({ name: 'test' })
      const b1 = {
        name: 'cb1',
        discharge: jest.fn()
      }
      const b2 = {
        name: 'cb2',
        discharge: jest.fn(),
        dependencies: ['cb1']
      }
      const b3 = {
        name: 'cb3',
        discharge: jest.fn(),
        dependencies: ['cb2']
      }
      mb.circuitBoards = [b1, b2, b3]
      mockDischargeModel(mb)
      mb.DischargeModel.findCompleteChildren.mockImplementation(async () => (['cb1']))
      mb.DischargeModel.markChildBoardDischarged.mockImplementation(async () => true)
      await mb.dischargeIfReady(mockDischargeId)
      expect(b1.discharge).not.toHaveBeenCalled()
      expect(b2.discharge).toHaveBeenCalled()
      expect(b3.discharge).not.toHaveBeenCalled()
    })

    test('should discharge board with all dependency complete', async () => {
      const mb = new MainBoard({ name: 'test' })
      const b1 = {
        name: 'cb1',
        discharge: jest.fn()
      }
      const b2 = {
        name: 'cb2',
        discharge: jest.fn(),
        dependencies: ['cb1']
      }
      const b3 = {
        name: 'cb3',
        discharge: jest.fn(),
        dependencies: ['cb2', 'cb1']
      }
      const b4 = {
        name: 'cb4',
        discharge: jest.fn(),
        dependencies: ['cb2', 'cb3']
      }
      mb.circuitBoards = [b1, b2, b3, b4]
      mockDischargeModel(mb)
      mb.DischargeModel.findCompleteChildren.mockImplementation(async () => (['cb1', 'cb2']))
      mb.DischargeModel.markChildBoardDischarged.mockImplementation(async () => true)
      await mb.dischargeIfReady(mockDischargeId)
      expect(b1.discharge).not.toHaveBeenCalled()
      expect(b2.discharge).not.toHaveBeenCalled()
      expect(b3.discharge).toHaveBeenCalled()
      expect(b4.discharge).not.toHaveBeenCalled()
    })

    test('should not discharge if markChildBoardDischarged return false which is when it is already discharged', async () => {
      const mb = new MainBoard({ name: 'test' })
      const b1 = {
        name: 'cb1',
        discharge: jest.fn()
      }
      const b2 = {
        name: 'cb2',
        discharge: jest.fn(),
        dependencies: ['cb1']
      }
      const b3 = {
        name: 'cb3',
        discharge: jest.fn(),
        dependencies: ['cb2', 'cb1']
      }
      const b4 = {
        name: 'cb4',
        discharge: jest.fn(),
        dependencies: ['cb2', 'cb3']
      }
      mb.circuitBoards = [b1, b2, b3, b4]
      mockDischargeModel(mb)
      mb.DischargeModel.findCompleteChildren.mockImplementation(async () => (['cb1', 'cb2']))
      mb.DischargeModel.markChildBoardDischarged.mockImplementation(async () => false)
      await mb.dischargeIfReady(mockDischargeId)
      expect(b1.discharge).not.toHaveBeenCalled()
      expect(b2.discharge).not.toHaveBeenCalled()
      expect(b3.discharge).not.toHaveBeenCalled()
      expect(b4.discharge).not.toHaveBeenCalled()
    })
  })

  describe('#aggregateDischargeStat', () => {
    test('should return 0 % complete|integrity if no subDischarges', async () => {
      const mb = new MainBoard({ name: 'test' })
      mb.findSubDischarges = jest.fn(async () => ([]))
      const ratio = await mb.aggregateDischargeStat()
      expect(ratio).toEqual({ completeRatio: 0, integrityRatio: 0 })
    })

    test('should calculate completeRatio from all of subDischarge', async () => {
      const mb = new MainBoard({ name: 'test' })
      mb.circuitBoards = [{}, {}, {}, {}]
      mb.findSubDischarges = jest.fn(async () =>
        ([
          { status: 'complete', stats: { completeRatio: 1 } },
          { status: 'complete', stats: { completeRatio: 0.7 } },
          { status: 'complete', stats: { completeRatio: 0.5 } }
        ])
      )
      const weight = 1/4
      const ratio = await mb.aggregateDischargeStat()
      expect(ratio).toEqual({
        completeRatio: (1 * weight) + (0.7 * weight) + (0.5 * weight),
        integrityRatio: 0.5
      })
    })
  })

  describe('#retry', () => {
    const mockDischargeModel = (mb) => {
      // class DischargeModel {
      //   async save() {
      //     this._id = mockDischargeId
      //     return true
      //   }
      mb.DischargeModel = {
        updateOne: jest.fn()
      }
      mb.findDischarges = jest.fn()
      mb.notifySlack = jest.fn()
    }
    test('should call board to retry', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockDischargeModel(mb)
      const dischargeId = 'd1'
      const parentId = 'p1'
      const mainDischarge = { _id: parentId }
      const retryDischargeFn = jest.fn(() => ({ _id: dischargeId, parentId }))
      mb.findDischarges.mockImplementation(() => [mainDischarge])

      mb.circuitBoards = [{
        name: 'cb1',
        retryDischarge: retryDischargeFn
      }]
      await mb.retry('cb1', dischargeId)
      expect(retryDischargeFn).toHaveBeenCalledWith(dischargeId, { type: 'Manual' })
      expect(mb.DischargeModel.updateOne).toHaveBeenCalledWith({
        _id: parentId
      }, {
        status: 'active'
      })
      expect(mb.notifySlack).toHaveBeenCalledWith('retry', mainDischarge)
    })
    test('should throw if board is not found', async () => {
      const mb = new MainBoard({ name: 'test' })
      const retryDischargeFn = jest.fn()
      mb.circuitBoards = [{
        name: 'cb1',
        retryDischarge: retryDischargeFn
      }]
      expect(retryDischargeFn).not.toHaveBeenCalled()
      await expect(mb.retry('cb2')).rejects.toEqual(new Error('MB:test CircuitBoard\'s name[cb2] is not registered.'))
    })
  })

  describe('#handshake', () => {
    const mockReplyId = 'rid'
    const mockReplyModel = (mb) => {
      class ReplyModel {
        async save() {
          this._id = mockReplyId
          return true
        }
      }
      mb.ReplyModel = ReplyModel
    }
    test('should call board to handshake', async () => {
      const mb = new MainBoard({ name: 'test' })
      mockReplyModel(mb)
      const electronId = 'e1'
      const resistorName = 'e1'
      const reply = { data: 'abc' }
      const handshakeFn = jest.fn()
      mb.circuitBoards = [{
        name: 'cb1',
        handshake: handshakeFn
      }]
      await mb.handshake('cb1', { electronId, resistorName, reply })
      expect(handshakeFn).toHaveBeenCalledWith(electronId, resistorName, mockReplyId)
    })

    test('should throw if board is not found', async () => {
      const mb = new MainBoard({ name: 'test' })
      const handshakeFn = jest.fn()
      mb.circuitBoards = [{
        name: 'cb1',
        handshake: handshakeFn
      }]
      expect(handshakeFn).not.toHaveBeenCalled()
      await expect(mb.handshake('cb2', {})).rejects.toEqual(new Error('MB:test CircuitBoard\'s name[cb2] is not registered.'))
    })
  })
})
