const Redis = require('ioredis')
const debug = require('debug')('electrician:stats')
const Promise = require('bluebird')

const TTL = 60 * 60 * 24 * 7

class RedisStat {
  constructor({ redisUrl, prefix, customStatuses, ttl } = {}) {
    this.redisUrl = redisUrl
    this.prefix = prefix || ''
    this.redisClient = new Redis(redisUrl)
    this.customStatuses = customStatuses || []
    this.ttl = ttl || TTL
  }

  close() {
    this.redisClient.disconnect()
  }

  getKey(id, status) {
    return `${this.prefix}:${id}:${status}`
  }

  async init(id, total) {
    const key = this.getKey(id, 'total')
    this.redisClient.set(key, total)
    // prepare all key 
  }

  // add member to key and set ttl to it
  async update(id, memberId, status) {
    const activeKey = this.getKey(id, 'active')
    const failedKey = this.getKey(id, 'failed')
    const completeKey = this.getKey(id, 'complete')
    const abortedKey = this.getKey(id, 'aborted')
    const markedAsCompleteKey = this.getKey(id, 'markedAsComplete')
    if (status === 'complete') {
      await this.redisClient.sadd(completeKey, memberId)
      await this.redisClient.expire(completeKey, this.ttl)
      await this.redisClient.srem(failedKey, memberId)
    } else if (status === 'markedAsComplete') {
      await this.redisClient.sadd(markedAsCompleteKey, memberId)
      await this.redisClient.expire(markedAsCompleteKey, this.ttl)
      await this.redisClient.srem(failedKey, memberId)
    } else if (status === 'failed') {
      await this.redisClient.sadd(failedKey, memberId)
      await this.redisClient.expire(failedKey, this.ttl)
    } else if (status === 'aborted') {
      await this.redisClient.sadd(abortedKey, memberId)
      await this.redisClient.expire(abortedKey, this.ttl)
    } else if (status === 'active') {
      await this.redisClient.sadd(activeKey, memberId)
      await this.redisClient.expire(activeKey, this.ttl)
      // For retry case
      await this.redisClient.srem(failedKey, memberId)
    // For custom stat including reserved status as "skipped"
    } else {
      const customKey = this.getKey(id, status)
      await this.redisClient.sadd(customKey, memberId)
      await this.redisClient.expire(customKey, this.ttl)
    }
  }

  async getMember(id, status) {
    const statusKey = this.getKey(id, status)
    const memberIds = await this.redisClient.smembers(statusKey)
    return memberIds
  }

  async removeMember(id, status, memberId) {
    const statusKey = this.getKey(id, status)
    return this.redisClient.srem(statusKey, memberId)
  }

  async getSummary(id) {
    const totalKey = this.getKey(id, 'total')
    const failedKey = this.getKey(id, 'failed')
    const abortedKey = this.getKey(id, 'aborted')
    const completeKey = this.getKey(id, 'complete')
    const markedAsCompleteKey = this.getKey(id, 'markedAsComplete')
    const skippedKey = this.getKey(id, 'skipped')
    const total = Number(await this.redisClient.get(totalKey))
    const complete = Number(await this.redisClient.scard(completeKey))
    const skipped = Number(await this.redisClient.scard(skippedKey))
    const markedAsComplete = Number(await this.redisClient.scard(markedAsCompleteKey))
    const failed = Number(await this.redisClient.scard(failedKey))
    const aborted = Number(await this.redisClient.scard(abortedKey))
    debug(`getStat ${this.prefix}:${id} total:${total} skipped:${skipped} complete:${complete}(marked:${markedAsComplete}) failed:${failed}, ${total === (complete+failed)}` )
    const summary = {
      total,
      complete,
      markedAsComplete,
      failed,
      aborted, // aborted status 
      skipped,
      isAllDone: false,
      completeRatio: (complete / (total - skipped)) || 0,
      probableComplete: total - skipped - failed
    }
    if (summary.total > 0) {
      summary.isAllDone = total === (complete + failed + skipped)
    }
    if (this.customStatuses.length > 0) {
      await Promise.each(this.customStatuses, async (customStatus) => {
        const customKey = this.getKey(id, customStatus)
        summary[customStatus] =  Number(await this.redisClient.scard(customKey))
      })
    }
    return summary
  }
}

module.exports = RedisStat
