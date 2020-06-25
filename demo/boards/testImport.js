const { CircuitBoard, PowerSource, Resistor } = require('../../')
const importStockConsumer = require('../consumers/importStockConsumers')


const importStockBoard = new CircuitBoard({
  name: 'importStockBoard',
  completeThreshold: 0.7
})

importStockBoard.usePowerSource(new PowerSource({
  generate: importStockConsumer.createStockElectricCurrent,
  next: 'getFinancial'
}))

importStockBoard.addResistor(new Resistor({
  name: 'getFinancial',
  consume: importStockConsumer.updateFinancial,
  queueOptions: {
    settings: {
      // Max time for processing job
      lockDuration: 5 * 60 * 1000, // 6 min
      lockRenewTime: 0.45 * 60 * 1000, // 45 s
      stalledInterval: 3 * 60 * 1000, // 3 min,
      maxStalledCount: 2
    }
  },
  next: 'getInterday'
}))

importStockBoard.addResistor(new Resistor({
  name: 'getInterday',
  consume: importStockConsumer.updateInterdays,
  next: 'intel'
}))

importStockBoard.addResistor(new Resistor({
  name: 'intel',
  consume: importStockConsumer.sendIntel,
  replyHandler: importStockConsumer.saveIntel,
  dependencies: ['getFinancial', 'getInterday'],
  next: 'ground'
}))


module.exports = importStockBoard
