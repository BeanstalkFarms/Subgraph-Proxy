// Module-scoped variable for global use. This is the latest block available on the chain
let chainHeads = {};

const getChainHead = (chain) => {
  return chainHeads[chain];
};

const setChainHead = (chain, blockNumber) => {
  chainHeads[chain] = blockNumber;
};

module.exports = {
  getChainHead,
  setChainHead
};
