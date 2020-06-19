require('dotenv').config()
const Electrician = require('../')

console.log('slack:', process.env.SLACK_HOOK_URL)
const electrician = new Electrician({
  mongoUrl: 'mongodb://localhost:27017/electrician',
  redisUrl: 'redis://localhost:6379',
  statsRedisUrl: 'redis://localhost:6379/1',
  enableSlack: false,
  slack: {
    webhookUrl: process.env.SLACK_HOOK_URL,
    channel: 'testbot',
    username: 'Electrician'
  }
})

module.exports = electrician
