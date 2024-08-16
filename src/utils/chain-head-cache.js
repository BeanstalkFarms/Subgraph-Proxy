// Module-scoped variable for global use. This is the latest block available on the chain
class ChainHeadCache {
  static chainHeads = {};

  static getChainHead(chain) {
    return this.chainHeads[chain];
  }

  static setChainHead(chain, blockNumber) {
    this.chainHeads[chain] = blockNumber;
  }
}

module.exports = ChainHeadCache;
