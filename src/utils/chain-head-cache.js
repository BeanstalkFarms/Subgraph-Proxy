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

// TODO: should also cache what is the latest available block across all the subgraphs.
// If there is a strategy to "wait until sunrise" for example, this way a subequent
// query does not need to explicitly provide a block number, it will guarantee to serve the result
// minimally of the latest indexed block

module.exports = ChainHeadCache;
