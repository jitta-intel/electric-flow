const Redis = require('ioredis')
const range = require('lodash.range')
const filter = require('lodash.filter')
const difference = require('lodash.difference')
const Promise = require('bluebird')

const client = new Redis('redis://192.168.142.46:6379/3')

const cbName = 'import_stock_xpressfeed'
const lastResistorName = 'postImportStock'
const dischargeId = '5ee725e583269b001e1739bc'




const getDiffJobId = async (cbName, resistorName, dischargeId) => {

  const resistorKey = `r:${resistorName}:${dischargeId}:complete`
  const circuitBoardKey = `cb:${cbName}:${dischargeId}:complete`

  const rJobIds = await client.smembers(resistorKey)
  const cbJobIds = await client.smembers(circuitBoardKey)
  return difference(rJobIds, cbJobIds)
}


getDiffJobId(cbName, lastResistorName, dischargeId).then((diffs) => console.log(diffs))