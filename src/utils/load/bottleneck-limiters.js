const { default: Bottleneck } = require('bottleneck');
const { ENDPOINTS, ENDPOINT_RATE_LIMITS } = require('../env');
const RateLimitError = require('../../error/rate-limit-error');

class BottleneckLimiters {
  static bottleneckLimiters = [];
  static maxPeriodicRquests = [];
  static maxReservoirSizes = [];

  // Create a limiter for each configured endpoint
  static {
    for (let i = 0; i < ENDPOINTS.length; ++i) {
      const [rqPerInterval, interval, maxBurst] = ENDPOINT_RATE_LIMITS[i];
      if (interval % 250 !== 0) {
        throw new Error('Invalid .env configuration: bottleneck requires rate limit interval divisible by 250.');
      }

      this.bottleneckLimiters.push(
        new Bottleneck({
          reservoir: maxBurst,
          reservoirIncreaseAmount: rqPerInterval,
          reservoirIncreaseInterval: interval,
          reservoirIncreaseMaximum: maxBurst,
          maxConcurrent: maxBurst,
          minTime: Math.ceil(interval / rqPerInterval)
        })
      );
      this.maxPeriodicRquests.push(rqPerInterval);
      this.maxReservoirSizes.push(maxBurst);
    }
  }

  static async wrap(endpointIndex, fnToWrap) {
    if (await this.isBurstDepleted(endpointIndex)) {
      // This shouldn't be executed if the EndpointBalanceUtil is working, though is in theory
      // possible in times of many concurrent requests.
      throw new RateLimitError(`Exceeded rate limit for e-${endpointIndex}.`);
    }
    console.log('reservoir size', await this.bottleneckLimiters[endpointIndex].currentReservoir());
    return this.bottleneckLimiters[endpointIndex].wrap(fnToWrap);
  }

  static async isBurstDepleted(endpointIndex) {
    return (await this.bottleneckLimiters[endpointIndex].currentReservoir()) === 0;
  }

  // Returns the utilization as a ratio of current active requests / max rq per interval.
  // Can exceed 100%
  static async getUtilization(endpointIndex) {
    const currentReservoir = await this.bottleneckLimiters[endpointIndex].currentReservoir();
    // These aren't necessarily still executing, but they are considered "active" in that they
    // were either scheduled recently or are queued to be executed.
    const activeRequests = this.maxReservoirSizes[endpointIndex] - currentReservoir;
    return activeRequests / this.maxPeriodicRquests[endpointIndex];
  }
}

module.exports = BottleneckLimiters;
