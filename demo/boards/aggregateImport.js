const { CircuitBoard, PowerSource, Resistor } = require('../../')


const aggregateBoard = new CircuitBoard({
  name: 'aggregateBoard'
})

aggregateBoard.usePowerSource(new PowerSource({
  generate: () => ([{}, {}, {}]),
  next: 'agg1'
}))


aggregateBoard.addResistor(new Resistor({
  name: 'agg1',
  consume: async (e, markComplete) => {
    // throw new Error('throw update error')
    return { result: 'agg1 result' }
  },
  next: 'agg2'
}))


aggregateBoard.addResistor(new Resistor({
  name: 'agg2',
  consume: (e) => {
    return { result: 'agg2 result' }
  },
  next: 'ground'
}))

module.exports = aggregateBoard
