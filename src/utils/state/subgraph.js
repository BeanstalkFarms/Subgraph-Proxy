const LoadBalanceUtil = require('../load-balance');
const SemVerUtil = require('../semver');
const ChainState = require('./chain');

class SubgraphState {
  /// Key is subgraphName
  // Latest timestamp of when an error check was performed for subgraphName
  static latestErrorCheck = {};

  /// Key for these is endpointIndex-subgraphName.
  // Qm hash of this endpoint's deployment
  static endpointDeployment = {};
  // Version of this endpoint's subgraph.
  static endpointVersion = {};
  // Latest indexed block of this endpoint's subgraph.
  static endpointBlock = {};
  // Boolean indicating the last known status of this endpoint. An "error" is defined as
  // (1) the subgraph crashed, (2) the subgraph is on a version with an incompatible schema, and queries are failing.
  static endpointHasErrors = {};

  static getLatestErrorCheck(subgraphName) {
    return this.latestErrorCheck[subgraphName];
  }
  static setLatestErrorCheck(subgraphName) {
    this.latestErrorCheck[subgraphName] = new Date();
  }

  static getEndpointDeployment(endpointIndex, subgraphName) {
    return this.endpointDeployment[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointDeployment(endpointIndex, subgraphName, deployment) {
    if (this.endpointDeployment[`${endpointIndex}-${subgraphName}`] !== deployment) {
      // Resets block number on new deployment
      this.setEndpointBlock(endpointIndex, subgraphName, 0);
    }
    this.endpointDeployment[`${endpointIndex}-${subgraphName}`] = deployment;
  }

  static getEndpointVersion(endpointIndex, subgraphName) {
    return this.endpointVersion[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointVersion(endpointIndex, subgraphName, version) {
    this.endpointVersion[`${endpointIndex}-${subgraphName}`] = version;
  }

  static getEndpointBlock(endpointIndex, subgraphName) {
    return this.endpointBlock[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointBlock(endpointIndex, subgraphName, blockNumber) {
    // Block number cannot decrease unless redeploy/error
    if (blockNumber > (this.endpointBlock[`${endpointIndex}-${subgraphName}`] ?? 0)) {
      this.endpointBlock[`${endpointIndex}-${subgraphName}`] = blockNumber;
    }
  }

  static endpointHasErrors(endpointIndex, subgraphName) {
    return this.endpointHasErrors[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointHasErrors(endpointIndex, subgraphName, value) {
    if (value) {
      // Resets block number on an error
      this.setEndpointBlock(endpointIndex, subgraphName, 0);
    }
    this.endpointHasErrors[`${endpointIndex}-${subgraphName}`] = value;
  }

  // Derived functions
  static getLatestVersion(subgraphName) {
    const versions = [];
    for (let i = 0; i < LoadBalanceUtil.numEndpointsConfigured(); ++i) {
      versions.push(this.endpointVersion[`${i}-${subgraphName}`]);
    }
    versions.sort(SemVerUtil.compareVersions);
    return versions[versions.length - 1];
  }

  static getLatestBlock(subgraphName) {
    const blocks = [];
    for (let i = 0; i < LoadBalanceUtil.numEndpointsConfigured(); ++i) {
      blocks.push(this.endpointBlock[`${i}-${subgraphName}`]);
    }
    blocks.sort();
    return blocks[blocks.length - 1];
  }

  // Not a perfect assumption - the endpoint is considered in sync if it is within 10 blocks of the chain head.
  static isInSync(endpointIndex, subgraphName, chain) {
    return this.getEndpointBlock(endpointIndex, subgraphName) + 10 > ChainState.getChainHead(chain);
  }
}

module.exports = SubgraphState;

// If a request to one endpoint fails, but the other endpoint succeeds, the failing endpoint
// can be considered as having crashed. Discord notification upon this.
// If requests to both endpoints fail, up to 1x per minute check the statuses using a known/safe query

// TODO: can implement some logic such that if there are 5 consecutive failed requests to a particular endpoint,
// then the proxy performs some known query (one that should succeed). if it does not, then the subgraph is
// considered to be in a failure state. there should be some time constraint here as well, i.e. 5 consecutive
// failed requests, up to one additional check every minute

// TODO: cache latest deployed version. Should avoid serving an older version unless the latest verison crashes.
// endpointIndex, subgraphName

// TODO: should also cache what is the latest available block across all the subgraphs.
// If there is a strategy to "wait until sunrise" for example, this way a subequent
// query does not need to explicitly provide a block number, it will guarantee to serve the result
// minimally of the latest indexed block
// subgraphName
