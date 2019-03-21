const express = require('express')

const moment = require('moment')
const app = express()

module.exports = (electrician) => {

  app.get('/mainboard', async (req, res) => {
    const mainboards = electrician.getMainBoards()
    return res.json(mainboards)
  })

  app.get('/mainboard/:name/discharge', async (req, res) => {
    const mb = electrician.getMainBoard(req.params.name)
    const query = {
      _id: req.query._id
    }
    const result = await mb.findDischarges(query)
    return res.json(result[0])
  })

  app.get('/mainboard/:name/discharges', async (req, res) => {
    let { start_date: startDate, end_date: endDate } = req.query
    const mb = electrician.getMainBoard(req.params.name)
    startDate = moment(startDate).startOf('day').toDate()
    endDate = moment(endDate).endOf('day').toDate()
    const query = {
      createdAt: { $gt: startDate, $lt: endDate }
    }
    return res.json(await mb.findDischarges(query))
  })

  app.post('/mainboard/:name/discharges', async (req, res) => {
    let { payload } = req.body
    const mb = electrician.getMainBoard(req.params.name)
    const discharge = await mb.discharge(payload)
    return res.json(discharge)
  })

  app.get('/mainboard/:name/subDischarges', async (req, res) => {
    const mb = electrician.getMainBoard(req.params.name)
    const query = {}
    const { includeNext } = req.query
    if (req.query.parentId) query._id = req.query.parentId
    const discharges = await mb.findDischarges(query)
    if (discharges.length > 0) {
      const subDischarges = await mb.findSubDischarges(discharges[0]._id, { resistorStat: true })
      // get undischarge dummy from circuitBoard
      if (includeNext) {
        const nextList = mb.createNextSubDischarges(subDischarges)
        return res.json([...subDischarges, ...nextList])
      }
      return res.json(subDischarges)
    }
    return res.json({ error: 'Not found' })
  })

  app.get('/mainboard/:name/subDischarges', async (req, res) => {
    const mb = electrician.getMainBoard(req.params.name)
    const query = {}
    if (req.query.parentId) query._id = req.query.parentId
    const discharges = await mb.findDischarges(query)
    if (discharges.length > 0) {
      const subDischarges = await mb.findSubDischarges(discharges[0]._id, { resistorStat: true })
      return res.json(subDischarges)
    }
    return res.json({ error: 'Not found' })
  })

  app.post('/mainboard/:name/subDischarges/retry', async (req, res) => {
    const mb = electrician.getMainBoard(req.params.name)
    const { boardName, dischargeId } = req.body
    const result = await mb.retry(boardName, dischargeId)
    console.log('retry result ', result)
    return res.json(result)
  })

  return app
}
