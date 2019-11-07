const { MainBoard } = require('../')
const singleBoard = require('./boards/singleBoard')


const mb2 = new MainBoard({ name: 'mb2' })
mb2.addCircuitBoard(singleBoard)

module.exports = mb2
