const { CircuitBoard, Resistor } = require('../../')


const singleTaskBoard = new CircuitBoard({
  name: 'singleTask'
})

singleTaskBoard.initSingleTaskWithResistor(new Resistor({
  name: 'sg1',
  consume: async (e, markComplete) => {
    // throw new Error('throw update error')
    return { result: 'sg1 result' }
  },
  next: 'sg2'
}))


singleTaskBoard.addResistor(new Resistor({
  name: 'sg2',
  consume: (e) => {
    return { result: 'sg2 result' }
  },
  next: 'ground'
}))

module.exports = singleTaskBoard
