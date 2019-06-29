const Electrician = require('../')

const electrician = new Electrician({
  mongoUrl: 'mongodb://localhost:27017/electrician',
  redisUrl: 'redis://localhost:6379',
  statsRedisUrl: 'redis://localhost:6379/1',
  enableSlack: true,
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/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8',
    channel: 'testbot',
    username: 'Electrician'
  }
})

module.exports = electrician
