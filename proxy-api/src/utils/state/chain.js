const EvmProviders = require('../../datasources/evm-providers');

const BLOCK_REFRESH_FREQUENCY = 1000;

const BLOCK_FREQUENCY = {
  ethereum: 12000,
  arbitrum: 250,
  base: 2000
};

class ChainState {
  // Latest block available on the chain
  static chainHeads = {};
  // Last time requesting the chain head for each block
  static lastChainHeadTime = {};

  static async getChainHead(chain) {
    if (!this.lastChainHeadTime[chain] || new Date() - this.lastChainHeadTime[chain] > BLOCK_REFRESH_FREQUENCY) {
      this.chainHeads[chain] = await EvmProviders.providerForChain(chain).getBlockNumber();
    }
    return this.chainHeads[chain];
  }

  static blocksPerInterval(chain, interval) {
    return Math.floor(interval / BLOCK_FREQUENCY[chain]);
  }
}

module.exports = ChainState;
