const fail = false
const forceComplete = true

const createStockElectricCurrent = async () => {
  const sampleStocks = [{
    exchange: 'BKK',
    symbol: 'KBANK'
  }, {
    exchange: 'BKK',
    symbol: 'SCP'
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO'
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO'
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO'
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO'
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO'
  }, {
  // result controlled
    exchange: 'BKK',
    symbol: 'HMPRO',
    fail,
  }, {
    exchange: 'BKK',
    symbol: 'HMPRO',
    fail,
  // }, {
  //   exchange: 'BKK',
  //   symbol: 'HMPRO',
  //   fail,
  // }, {
  //   exchange: 'BKK',
  //   symbol: 'HMPRO',
  //   fail,
  // }, {
  //   exchange: 'BKK',
  //   symbol: 'HMPRO',
  //   fail,
  // }, {
  //   exchange: 'BKK',
  //   symbol: 'HMPRO',
  //   fail,
  // }, {
  //   exchange: 'BKK',
  //   symbol: 'HMPRO',
  //   fail,
  }]
  return new Promise((res, reject) => setTimeout(() => {
    // return reject(new Error('force power source error '))
    return res(sampleStocks)
  }, 30000))
}

const updateFinancial = async (payload) => {

  // save financial
  return new Promise(res => setTimeout(res, 10000))
  // return {
  //   payload,
  //   result: 'updateFinancial'
  // }
}

const updateInterdays = async (payload) => {
  console.log('update unterday ', payload)
  if (payload.data.fail && !forceComplete) {
    throw new Error('throw update error')
  }
  return new Promise(res => setTimeout(res, 10000))
  // return {
  //   payload,
  //   result: 'updateInterdays'
  // }
}

const sendIntel = async (payload) => {
  // return {
  //   payload,
  //   result: 'sendIntel'
  // }
  return new Promise(res => setTimeout(res, 1000))
}

const saveIntel = async (payload) => {
  return {
    payload,
    result: 'saveIntel'
  }
}

module.exports = {
  createStockElectricCurrent,
  updateFinancial,
  updateInterdays,
  sendIntel,
  saveIntel
}
