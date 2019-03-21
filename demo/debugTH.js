const Redis = require('ioredis')
const range = require('lodash.range')
const filter = require('lodash.filter')
const includes = require('lodash.includes')
const Promise = require('bluebird')

const client = new Redis('redis://10.243.249.103:6379/2')

// 823
const queryKey = 'bull:import_stock_xpressfeed:resistor:intel:'


const getElectronIds = async (prefix, start, end) => {
  const jobIds = []
  const ids = []
  await Promise.each(range(start, end + 1), async (i) => {
    console.log('get ', prefix + i)
    const payload = await client.hget(prefix + i, 'data')
    // console.log('got ', payload)
    if (payload) {
      jobIds.push(i)
      ids.push(JSON.parse(payload)._id)
    }
    // console.log('get ', prefix + i, payload)
  })
  return { ids, jobIds }
}

let subjectResult

getElectronIds(queryKey, 30000, 60000)
.then(({ ids, jobIds }) => {
  subjectResult = { ids, jobIds }
  // const foundIndex = ids.indexOf('5afc0acb9f55830047b16fbe')
  // console.log('found Index', foundIndex, 'job id:', jobIds[foundIndex])
})

// 824
const testKey = 'bull:import_stock_xpressfeed:resistor:saveLossChance:'

getElectronIds(testKey, 30000, 60000)
.then(({ ids, jobIds }) => {
  console.log(subjectResult.ids, ids)
  // const dupIds = filter(ids, function (value, index, iteratee) {
  //   return includes(iteratee, value, index + 1);
  // })
  // console.log(dupIds)
  // const dupIndex = ids.indexOf(dupIds[0])
  // console.log('dup Index', dupIndex, 'job id:', jobIds[dupIndex])
  // const dupIndex2 = ids.indexOf(dupIds[0], dupIndex + 1)
  // console.log('dup Index2', dupIndex2, 'job id:', jobIds[dupIndex2])

})


