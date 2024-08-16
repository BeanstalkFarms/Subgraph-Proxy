const rateLimitConfig = {
  id: 'alchemy-subgraphs',
  requestsPerInterval: 30,
  maxBuffer: 300,
  interval: 1000
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RateLimitUtil {
  // Integer place in line for each caller
  static queue = {};
  // Timestamp corresponding to when the request was allowed to begin.
  // There should be no more than `config.requestsPerInterval` entries in here at a time.
  static passedTimestamps = {};

  static wait(config) {
    return new Promise((resolve, reject) => {
      (async () => {
        if (!this.passedTimestamps[config.id]) {
          this.passedTimestamps[config.id] = [];
          this.queue[config.id] = 0;
        }

        this.removePastEntries(config);

        if (this.passedTimestamps.length > config.maxBuffer) {
          reject(`Exceeded rate limit for ${config.id}`);
        }

        // Set place in line values
        const now = Date.now();
        const myId = this.getMaxId(config) + 1;
        this.queue[config.id].push(myId);

        // Waits until myId is within the request window
        while (true) {
          if (myId <= this.queue[config.requestsPerInterval - 1] ?? Number.MAX_SAFE_INTEGER) {
            // Now that the request is allowed through, add to list
            this.passedTimestamps[config.id].push(now);
            resolve();
            return;
          } else {
            this.removePastEntries(config);
            await sleep(250);
          }
        }
      })();
    });
  }

  // Remove timestamps older than the configured lifetime
  static removePastEntries(config) {
    const now = Date.now();
    while (this.passedTimestamps[config.id].length && this.passedTimestamps[config.id][0] <= now - config.interval) {
      this.passedTimestamps[config.id].shift();
      this.queue[config.id].shift();
    }
  }

  static getMaxId(config) {
    return this.queue[config.id][this.queue[config.id].length - 1] ?? 0;
  }
}

module.exports = RateLimitUtil;
