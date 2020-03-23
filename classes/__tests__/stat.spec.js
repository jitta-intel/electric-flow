const _ = require('lodash')
const Redis = require('ioredis')
const Stat = require('../stat')

describe('Stat', () => {
  describe('#constructor', () => {
    test('should set initial value and init redis client', () => {
      const input = {
        redisUrl: 'redis://localhost:6379',
        prefix: 'rs',
        customStatuses: ['status1', 'status2']
      }
      const stat = new Stat(input)
      expect(stat.redisUrl).toEqual(input.redisUrl)
      expect(stat.prefix).toEqual(input.prefix)
      expect(stat.customStatuses).toEqual(input.customStatuses)
      expect(stat.redisClient).toBeInstanceOf(Redis)
      stat.close()
    })
  })

  describe('#getKey', () => {
    test('should compose key', () => {
      const prefix = 'rs'
      const id = 'eid'
      const status = 'active'
      const stat = new Stat({
        prefix
      })
      const result = stat.getKey(id, status)
      expect(result).toEqual(`${prefix}:${id}:${status}`)
      stat.close()
    })
  })

  describe('#init', () => {
    let redisClient
    beforeEach(() => {
      redisClient = new Redis()
    })
    afterEach(async () => {
      return redisClient.disconnect()
    })
    test('should set total key', async () => {
      const prefix = 'rs'
      const total = 20
      const id = 'id'
      const stat = new Stat({ prefix })
      await stat.init(id, total)

      const result = await redisClient.get('rs:id:total')
      expect(result).toEqual('20')
      stat.close()
    })
  })


  describe('#update', () => {
    let stat
    let redisClient
    beforeEach(() => {
      stat = new Stat({ ttl: 10 })
      redisClient = new Redis()
    })
    afterEach(async () => {
      await redisClient.flushdb()
      stat.close()
      return redisClient.disconnect()
    })
    test('should add complete and remove failed when add complete list', async () => {
      const completeKey = ':id:complete'
      const failedKey = ':id:failed'
      await redisClient.sadd(failedKey, 'e1', 'e2')
      await stat.update('id', 'e1', 'complete')
      const ttl = await redisClient.ttl(completeKey)
      const completeMembers = await redisClient.smembers(completeKey)
      const failedMembers = await redisClient.smembers(failedKey)
      expect(ttl).toEqual(10)
      expect(completeMembers).toEqual(['e1'])
      expect(failedMembers).toEqual(['e2'])
    })

    test('should add markedAsComplete and remove failed when add markedAsComplete list', async () => {
      const markedCompleteKey = ':id:markedAsComplete'
      const failedKey = ':id:failed'
      await redisClient.sadd(failedKey, 'e1', 'e2')
      await stat.update('id', 'e1', 'markedAsComplete')
      const ttl = await redisClient.ttl(markedCompleteKey)
      const markedCompleteMembers = await redisClient.smembers(markedCompleteKey)
      const failedMembers = await redisClient.smembers(failedKey)
      expect(ttl).toEqual(10)
      expect(markedCompleteMembers).toEqual(['e1'])
      expect(failedMembers).toEqual(['e2'])
    })

    test('should add failed list', async () => {
      const failedKey = ':id:failed'
      await stat.update('id', 'e1', 'failed')
      const ttl = await redisClient.ttl(failedKey)
      const failedMembers = await redisClient.smembers(failedKey)
      expect(ttl).toEqual(10)
      expect(failedMembers).toEqual(['e1'])
    })

    test('should add aborted list', async () => {
      const abortedKey = ':id:aborted'
      await stat.update('id', 'e1', 'aborted')
      const ttl = await redisClient.ttl(abortedKey)
      const abortedMembers = await redisClient.smembers(abortedKey)
      expect(ttl).toEqual(10)
      expect(abortedMembers).toEqual(['e1'])
    })

    test('should add active and remove failed when add active list', async () => {
      const activeKey = ':id:active'
      const failedKey = ':id:failed'
      await redisClient.sadd(failedKey, 'e1', 'e2')
      await stat.update('id', 'e1', 'active')
      const ttl = await redisClient.ttl(activeKey)
      const activeMembers = await redisClient.smembers(activeKey)
      const failedMembers = await redisClient.smembers(failedKey)
      expect(ttl).toEqual(10)
      expect(activeMembers).toEqual(['e1'])
      expect(failedMembers).toEqual(['e2'])
    })

    test('should add custom status list', async () => {
      const stalledKey = ':id:stalled'
      await redisClient.sadd(stalledKey, 'e1', 'e2')
      await stat.update('id', 'e3', 'stalled')
      const ttl = await redisClient.ttl(stalledKey)
      const stalledMembers = await redisClient.smembers(stalledKey)
      expect(ttl).toEqual(10)
      expect(stalledMembers).toEqual(expect.arrayContaining(['e1', 'e2', 'e3']))
    })
  })

  describe('#getMembers', () => {
    let stat
    let redisClient
    beforeEach(() => {
      stat = new Stat({ ttl: 10 })
      redisClient = new Redis()
    })
    afterEach(async () => {
      await redisClient.flushdb()
      stat.close()
      return redisClient.disconnect()
    })
    test('should return members of status set', async () => {
      const id = ':id1:active'
      await redisClient.sadd(id, 'e1', 'e2')
      const members = await stat.getMember('id1', 'active')
      expect(members).toEqual(expect.arrayContaining(['e1', 'e2']))
    })
  })

  describe('#removeMember', () => {
    let stat
    let redisClient
    beforeEach(() => {
      stat = new Stat({ ttl: 10 })
      redisClient = new Redis()
    })
    afterEach(async () => {
      await redisClient.flushdb()
      stat.close()
      return redisClient.disconnect()
    })
    test('should remove single memberId of status set', async () => {
      const id = ':id1:active'
      await redisClient.sadd(id, 'e1', 'e2')
      await stat.removeMember('id1', 'active', 'e2')

      const members = await redisClient.smembers(id)
      expect(members).toEqual(expect.arrayContaining(['e1']))
    })
  })

  describe('#getSummary', () => {
    let stat
    let redisClient
    beforeEach(() => {
      stat = new Stat({ ttl: 10 })
      redisClient = new Redis()
    })
    afterEach(async () => {
      await redisClient.flushdb()
      stat.close()
      return redisClient.disconnect()
    })
    test('should return summary stats of all status', async () => {
      await redisClient.set(':id1:total', 10)
      await redisClient.sadd(':id2:complete', 'e5', 'e6', 'e7') // out of scope
      await redisClient.sadd(':id1:active', 'e5')
      await redisClient.sadd(':id1:complete', 'e1', 'e2')
      await redisClient.sadd(':id1:markedAsComplete', 'e3')
      await redisClient.sadd(':id1:failed', 'e4')
      await redisClient.sadd(':id1:skipped', 'e6')


      const result = await stat.getSummary('id1')

      expect(result).toEqual({
        total: 10,
        complete: 2,
        markedAsComplete: 1,
        failed: 1,
        aborted: 0,
        skipped: 1,
        isAllDone: false,
        completeRatio: 0.2222222222222222,
        probableComplete: 8
      })
    })

    test('should return summary stats of all status with custom statuses', async () => {
      await redisClient.set(':id1:total', 10)
      await redisClient.sadd(':id2:complete', 'e5', 'e6', 'e7') // out of scope
      // await redisClient.sadd(':id1:active', 'e5')
      await redisClient.sadd(':id1:complete', 'e1', 'e2', 'e3', 'e4', 'e5', 'e7')
      await redisClient.sadd(':id1:markedAsComplete', 'e3')
      await redisClient.sadd(':id1:failed', 'e8', 'e9', 'e10')
      await redisClient.sadd(':id1:skipped', 'e6')

      // custom stat
      await redisClient.sadd(':id1:nice', 'e6')
      await redisClient.sadd(':id1:good', 'e6', 'e7')

      stat.customStatuses = ['nice', 'good']
      const result = await stat.getSummary('id1')


      expect(result).toEqual({
        total: 10,
        complete: 6,
        markedAsComplete: 1,
        failed: 3,
        aborted: 0,
        skipped: 1,
        isAllDone: true,
        completeRatio: 0.66666666666666666,
        probableComplete: 6,
        nice: 1,
        good: 2
      })
    })
  })
})