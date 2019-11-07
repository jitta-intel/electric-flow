## Installation

```sh
$ npm install electric-flow
```

required bull and arena ui for bull queue.

### Quick start
```js
const ElectricFlow = require('electric-flow')

const electricFlow = new ElectricFlow({
  mongoUrl: 'mongodb://localhost:27017/electric-flow',
  redisUrl: 'redis://localhost:6379',
  statsRedisUrl: 'redis://localhost:6379/1',
  enableSlack: true,
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/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9',
    channel: 'testbot',
    username: 'Electric-bot'
  }
})
const mainboard = new ElectricFlow.MainBoard({})
electricFlow.register(mainboard)
// init all mainboard connection
electricFlow.start()
```

The `settings` fields are:

- `mongoUrl`: string, mongodb to store electron and discharge.
- `redisUrl`: string, redis to store bull queue.
- `statsRedisUrl`: (optional) string, redis to store statistics of job status.
- `enableSlack`: boolean, enable slack notifications.
- `slack`: object, slack noti settings.
  - `webhoolUrl`: string, webhook url from slack incoming webhook.
  - `channel`: string, slack channel to send noti.
  - `username`: string, slack sender's name to send noti.


### How to start worker ###
```js
const ElectricFlow = require('electric-flow')

const electricFlow = new ElectricFlow({})

const mainboard = new ElectricFlow.MainBoard({})
electrician.register(mainboard)
// init all mainboard connection and worker
electrician.worker()
```


### How to apply middleware for api

example:

```js
const express = require('express')
const ElectricFlow = require('electric-flow')


const electricFlow = new Electrician()
const app = express()


electricFlow.applyApiMiddleware({ app: server, basePath: '' })
```

The `settings` fields are:

- `app`: Express app.
- `basePath`: object, basePath for api and arena ui.


### Shortcut for single task circuitboard
```js

const singleTaskBoard = new CircuitBoard({
  name: 'singleTask'
})

singleTaskBoard.initSingleTaskWithResistor(new Resistor({
  name: 'resistor1',
  consume: (e) => {
    // throw new Error('throw update error')
    return { result: 'sg1 result' }
  },
  next: 'ground'
}))
```

### create powersource, resistor and circuitboard
```js

const cboard = new CircuitBoard({
  name: 'cboard'
})

// create powersource and add to circuitboard
cboard.usePowerSource(new PowerSource({
  generate: () => ([{}, {}, {}]), // generate 3 task
  next: 'resistor1' // redirect to resistor with name
}))

// create resistor and add to circuitboard
cboard.addResistor(new Resistor({
  name: 'resistor1',
  consume: async (e) => {
    // throw new Error('throw update error')
    return { result: 'result1' }
  },
  next: 'resistor2' // redirect to resistor 2 after complete
}))


cboard.addResistor(new Resistor({
  name: 'resistor2',
  consume: (e) => {
    return { result: 'result2' }
  },
  next: 'ground' // complete circuit with ground
}))
```
