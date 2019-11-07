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

const resistor = new Resistor({
  name: 'sg2',
  consume: (e) => {
    return { result: 'sg2 result' }
  },
  next: 'ground'
})

singleTaskBoard.addResistor(resistor)
// testing reuse resistor error
// singleTaskBoard.addResistor(resistor)

module.exports = singleTaskBoard
