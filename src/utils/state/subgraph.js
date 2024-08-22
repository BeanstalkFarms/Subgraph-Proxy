const LoadBalanceUtil = require('../load-balance');
const SemVerUtil = require('../semver');
const ChainState = require('./chain');

class SubgraphState {
  /// Key is subgraphName
  // Latest timestamp of when an error check was performed for subgraphName
  static _latestErrorCheck = {};

  /// Key for these is endpointIndex-subgraphName.
  // Qm hash of this endpoint's deployment
  static _endpointDeployment = {};
  // Version of this endpoint's subgraph.
  static _endpointVersion = {};
  // Chain of this endpoint's subgraph.
  static _endpointChain = {};
  // Latest indexed block of this endpoint's subgraph.
  static _endpointBlock = {};
  // Boolean indicating the last known status of this endpoint. An "error" is defined as
  // (1) the subgraph crashed, (2) the subgraph is on a version with an incompatible schema, and queries are failing.
  static _endpointHasErrors = {};

  static getLatestErrorCheck(subgraphName) {
    return this._latestErrorCheck[subgraphName];
  }
  static setLatestErrorCheck(subgraphName) {
    this._latestErrorCheck[subgraphName] = new Date();
  }

  static getEndpointDeployment(endpointIndex, subgraphName) {
    return this._endpointDeployment[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointDeployment(endpointIndex, subgraphName, deployment) {
    if (this._endpointDeployment[`${endpointIndex}-${subgraphName}`] !== deployment) {
      // Resets block number on new deployment
      this.setEndpointBlock(endpointIndex, subgraphName, 0);
    }
    this._endpointDeployment[`${endpointIndex}-${subgraphName}`] = deployment;
  }

  static getEndpointVersion(endpointIndex, subgraphName) {
    return this._endpointVersion[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointVersion(endpointIndex, subgraphName, version) {
    this._endpointVersion[`${endpointIndex}-${subgraphName}`] = version;
  }

  static getEndpointChain(endpointIndex, subgraphName) {
    return this._endpointChain[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointChain(endpointIndex, subgraphName, chain) {
    this._endpointChain[`${endpointIndex}-${subgraphName}`] = chain;
  }

  static getEndpointBlock(endpointIndex, subgraphName) {
    return this._endpointBlock[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointBlock(endpointIndex, subgraphName, blockNumber) {
    // Block number cannot decrease unless redeploy/error
    if (blockNumber > (this._endpointBlock[`${endpointIndex}-${subgraphName}`] ?? 0)) {
      this._endpointBlock[`${endpointIndex}-${subgraphName}`] = blockNumber;
    }
  }

  static endpointHasErrors(endpointIndex, subgraphName) {
    return this._endpointHasErrors[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointHasErrors(endpointIndex, subgraphName, value) {
    if (value) {
      // Resets block number on an error
      this.setEndpointBlock(endpointIndex, subgraphName, 0);
    }
    this._endpointHasErrors[`${endpointIndex}-${subgraphName}`] = value;
  }

  // Derived functions
  static getLatestVersion(subgraphName) {
    let versions = [];
    for (let i = 0; i < LoadBalanceUtil.numEndpointsConfigured(); ++i) {
      versions.push(this._endpointVersion[`${i}-${subgraphName}`]);
    }
    versions = versions.filter((v) => v !== undefined).sort(SemVerUtil.compareVersions);
    return versions[versions.length - 1];
  }

  static getLatestBlock(subgraphName) {
    let blocks = [];
    for (let i = 0; i < LoadBalanceUtil.numEndpointsConfigured(); ++i) {
      blocks.push(this._endpointBlock[`${i}-${subgraphName}`]);
    }
    blocks = blocks.filter((v) => v !== undefined).sort();
    return blocks[blocks.length - 1];
  }

  // Not a perfect assumption - the endpoint is considered in sync if it is within 10 blocks of the chain head.
  static async isInSync(endpointIndex, subgraphName, chain) {
    return this.getEndpointBlock(endpointIndex, subgraphName) + 10 > (await ChainState.getChainHead(chain));
  }

  static allHaveErrors(subgraphName) {
    for (let i = 0; i < LoadBalanceUtil.numEndpointsConfigured(); ++i) {
      if (!this.endpointHasErrors(i, subgraphName)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = SubgraphState;
