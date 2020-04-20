const request = require('request-promise')
const debug = require('debug')('electrician:slack')

const ENV = process.env.NODE_ENV === 'development' ? '-dev' : ''

class Slack {
  constructor({
    enable,
    webhookUrl,
    channel,
    username
  }) {
    this.enable = enable
    this.webhookUrl = webhookUrl
    this.channel = channel
    this.username = username
  }

  async request(message) {
    return request.post({
      method: 'POST',
      uri: this.webhookUrl,
      body: {
        ...message,
        channel: this.channel,
        username: `${this.username}${ENV}`
      },
      json: true
    })
    .catch((error) => {
      console.error(error)
    })
  }

  async send(text, { name, payload, color, type = 'noti' }) {
    const formattedText = this.createText(name, payload, text)
    let message
    if (type === 'noti') {
      message = {
        attachments: [{
          text: formattedText,
          color,
        }]
      }
    } else {
      message = { text: formattedText }
    }
    if (this.enable) {
      await this.request(message)
      debug('notify slack', message)
    } else {
      debug('send but not enable', message)
    }
  }

  stringifyPayload(payload = {}) {
    const args = []
    Object.keys(payload).map((key) => {
      if (typeof payload[key] === 'object') {
        return args.push(`${key}:${JSON.stringify(payload[key])}`)
      }
      return args.push(`${key}:${payload[key]}`)
    })
    return args.join(',')
  }

  createText(name, payload, text) {
    const payloadStr = this.stringifyPayload(payload)
    return `${name} - ${payloadStr} - ${text}.`
  }
}


module.exports = Slack
