const RESISTOR_TYPES = {
  NORMAL: 'normal',
  HANDSHAKE: 'handshake'
}

const RESISTOR_OUTPUT_STATUS = {
  COMPLETE: 'complete',
  FAILED: 'failed',
  WAITING: 'waiting'
}
// in ms 
// Default will be used for cleaning handshake process for now
const RESISTOR_DEFAULT_TIMEOUT = 60 * 60 * 1000

module.exports = {
  RESISTOR_TYPES,
  RESISTOR_OUTPUT_STATUS,
  RESISTOR_RETRY_LIMIT: 3,
  RESISTOR_RETRY_DELAY: 0,
  RESISTOR_DEFAULT_TIMEOUT
}
