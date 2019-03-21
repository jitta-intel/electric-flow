const { MainBoard } = require('../')

const testImportBoard = require('./boards/testImport')
const afterImportBoard = require('./boards/afterImport')
const aggBoard = require('./boards/aggregateImport')


afterImportBoard.addDependency(testImportBoard)
aggBoard.addDependency(afterImportBoard)


const mb1 = new MainBoard({ name: 'mb1' })
mb1.addCircuitBoard(testImportBoard)
mb1.addCircuitBoard(afterImportBoard)
mb1.addCircuitBoard(aggBoard)

module.exports = mb1
