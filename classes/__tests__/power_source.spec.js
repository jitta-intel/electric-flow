const mongoose = require('mongoose')
const PowerSource = require('../power_source')
const electronSchema = require('../../models/electron')

describe('PowerSource', () => {
  describe.only('#generateElectrons', () => {
    const ElectronModel = mongoose.model('Electron', electronSchema)
    ElectronModel.insertMany = jest.fn((els) => els)

    test('should call generate and save all electron to storage', async () => {
      const payload = { market: 'TH' }
      const electronData = { symbol: 'BKK:KBANK' }
      const dischargeId = new mongoose.Types.ObjectId
      const ps = new PowerSource({
        generate: jest.fn((payload) => {
          return [electronData]
        })
      })
      ps.ElectronModel = ElectronModel

      const result = await ps.generateElectrons({ dischargeId, payload })
      expect(ps.generate).toHaveBeenCalledWith(payload)
      expect(ElectronModel.insertMany)
    })

    test('should transform object response to array before create electron', () => {

    })
  })


  describe('#start', () => {
    test('should error when no mongoose connection', async () => {
      const ps = new PowerSource()
      expect(ps.start()).rejects.toEqual(new Error('mongooseConnection has not been set'))
    })

    test('should generate electrons', async () => {
      const discharge = {
        _id: 'd1',
        payload: 'pp'
      }
      const electron = {
        _id: 'e1'
      }
      const ps = new PowerSource()
      ps.ElectronModel = {}
      ps.generateElectrons = jest.fn(() => [electron])
      const result = await ps.start(discharge)
      expect(ps.generateElectrons).toHaveBeenCalledWith({
        dischargeId: discharge._id,
        payload: discharge.payload
      })
      expect(result).toEqual([electron])
    })
  })

  describe('#listen', () => {
    test('should listen to self queue', () => {
      const ps = new PowerSource()
      ps.queue = {
        process: jest.fn()
      }
      ps.listen()
      expect(ps.queue.process).toHaveBeenCalled()
    })
  })
})
