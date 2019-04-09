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
