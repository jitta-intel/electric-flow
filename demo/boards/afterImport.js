const { CircuitBoard, PowerSource, Resistor } = require('../../')


const afterBoard = new CircuitBoard({
  name: 'afterImportBoard'
})

afterBoard.usePowerSource(new PowerSource({
  generate: () => ([{}, {}, {}]),
  //next: 'import1'
  next: 'import2'
}))

let i = 0

// afterBoard.addResistor(new Resistor({
//   name: 'import1',
//   type: 'handshake',
//   // startDelay: 3000,
//   timeout: 3 *60 * 1000,
//   retryDelay: 10000,
//   consume: async (e, markComplete) => {
//     // if (i == 1) t
//     // throw new Error('force errro' + i)
//     // i += 1
//     // console.log('mark as complete ', e)
//     // setTimeout(async () => {
//       // await markComplete(e)
//       return { result: 'import1 result' }
//     // }, 1000000)
//     // return new Promise(res => setTimeout(res, 10000000))
//   },
//   replyHandler: async(e, reply, markComplete) => {
//     console.log(' got reply ', reply)
//     return { result: 'after reply', reply }
//   },
//   next: 'import2'
// }))


afterBoard.addResistor(new Resistor({
  name: 'import2',
  consume: (e) => {
    // if (i == 1) throw new Error('force errro' + i)
    // i += 1
    return { result: 'import2 result' }
  },
  next: 'import3'
}))

afterBoard.addResistor(new Resistor({
  name: 'import3',
  consume: (e) => {
    // if (i == 1) throw new Error('force errro' + i)
    // i += 1
    return { result: 'import3 result' }
  },
  next: 'ground'
}))

module.exports = afterBoard
