const Redis = require('ioredis')
const range = require('lodash.range')
const filter = require('lodash.filter')
const difference = require('lodash.difference')
const Promise = require('bluebird')

const client = new Redis('redis://192.168.142.46:6379/3')


const resistor = 'intel'
const dischargeId = '5ee9aa587902d4002d7feae1'




const getDiffJobId = async (resistor, dischargeId) => {
  const queryKey = `r:${resistor}:${dischargeId}`

  const consumedKey = `${queryKey}:consumed`
  const completeKey = `${queryKey}:complete`

  const completeJobIds = await client.smembers(completeKey)
  const consumedJobIds = await client.smembers(consumedKey)
  return difference(consumedJobIds, completeJobIds)
}


getDiffJobId(resistor, dischargeId).then((diffs) => console.log(diffs))