## Installation

```sh
$ npm install electric-flow
```

required bull and arena ui for bull queue.

### Quick start
```js
const ElectricFlow = require('electric-flow')

const electrician = new Electrician({
  mongoUrl: 'mongodb://localhost:27017/electric-flow',
  redisUrl: 'redis://localhost:6379',
  statsRedisUrl: 'redis://localhost:6379/1',
  enableSlack: true,
  slack: {
    webhookUrl: 'https://hooks.slack.com/services/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8',
    channel: 'testbot',
    username: 'Electric-bot'
  }
})
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