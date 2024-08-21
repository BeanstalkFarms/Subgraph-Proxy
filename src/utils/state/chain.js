class ChainState {
  // Latest block available on the chain
  static chainHeads = {};

  static getChainHead(chain) {
    // TODO: if chain head has not been requested onchain in the past second, request it now
    return 5;
    // return this.chainHeads[chain];
  }

  static setChainHead(chain, blockNumber) {
    this.chainHeads[chain] = blockNumber;
  }
}

module.exports = ChainState;
