const _ = require('lodash')
const moment = require('moment')
const { createLogger, format, transports, config: winstonConfig } = require('winston')
const { combine, timestamp, label, printf } = format
const { levels } = winstonConfig.npm

const serviceName = 'Electrician'
const ISO_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss.SSSZ'
const logLevel = 'info'

/***
 * example usage
 * const { makeLogger } = require('../../lib/helper')
 * const log = makeLogger([options.serviceName, 'retry'])
 * log.info("this is an info")
 * log.error("this is an error")
 */

const myFormat = printf(info => `${moment(info.timestamp).format(constant.ISO_FORMAT)} [${info.label}:${info.tags}] ${info.level}: ${info.message}`)
const logger = createLogger({
  level: logLevel,
  levels,
  format: combine(
    format.colorize(),
    label({ label: serviceName }),
    timestamp(),
    myFormat
  ),
  transports: [new transports.Console()]
})

const _makeLogger = _logger => tags =>
  Object.keys(levels).reduce((obj, level) => {
    obj[level] = (message, options) => {
      _logger.log(level, message, _.mergeWith({}, { tags }, options, (objValue, srcValue) => {
        if (_.isArray(objValue)) {
          return objValue.concat(srcValue)
        }
      }))
    }
    return obj
  }, {})

module.exports = {
  makeLogger: _makeLogger(logger),
  logger
}
