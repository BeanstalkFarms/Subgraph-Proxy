const { default: Bottleneck } = require('bottleneck');
const { ENDPOINTS, ENDPOINT_RATE_LIMITS } = require('../env');

const MAX_CONCURRENT_SCALAR = 2;

class BottleneckLimiters {
  static bottleneckLimiters = [];

  // Create a limiter for each configured endpoint
  static {
    for (let i = 0; i < ENDPOINTS.length; ++i) {
      const [rqPerInterval, interval, maxBurst] = ENDPOINT_RATE_LIMITS[i];
      if (interval % 250 !== 0) {
        throw new Error('Invalid .env configuration: bottleneck requires rate limit interval divisible by 250.');
      }

      this.bottleneckLimiters.push(
        new Bottleneck({
          reservoir: rqPerInterval,
          reservoirIncreaseAmount: rqPerInterval,
          reservoirIncreaseInterval: interval,
          reservoirIncreaseMaximum: maxBurst,
          maxConcurrent: rqPerInterval * MAX_CONCURRENT_SCALAR,
          minTime: Math.ceil(interval / rqPerInterval)
        })
      );
    }
  }

  static getLimiter(endpointIndex) {
    return this.bottleneckLimiters[endpointIndex];
  }
}

module.exports = BottleneckLimiters;
