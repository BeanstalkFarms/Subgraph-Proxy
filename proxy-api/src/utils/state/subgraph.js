const EnvUtil = require('../env');
const SemVerUtil = require('../semver');
const ChainState = require('./chain');

class SubgraphState {
  /// Key is subgraphName
  // Latest timestamp of when an error check was performed for subgraphName
  static _latestSubgraphErrorCheck = {};

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
  // Only true when the subgraph implementation's status endpoint indicates a fatal error.
  static _endpointHasFatalErrors = {};
  // Timestamps of notable events on this endpoint: errors, out of sync, and stale version.
  // The timestamp is updated any time one of these is encountered.
  static _endpointTimestamps = {};

  static getLatestSubgraphErrorCheck(subgraphName) {
    return this._latestSubgraphErrorCheck[subgraphName];
  }
  static setLatestSubgraphErrorCheck(subgraphName) {
    this._latestSubgraphErrorCheck[subgraphName] = new Date();
  }

  static getEndpointDeployment(endpointIndex, subgraphName) {
    return this._endpointDeployment[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointDeployment(endpointIndex, subgraphName, deployment) {
    if (this._endpointDeployment[`${endpointIndex}-${subgraphName}`] !== deployment) {
      // Resets block number on new deployment
      this._endpointBlock[`${endpointIndex}-${subgraphName}`] = 0;
    }
    this._endpointDeployment[`${endpointIndex}-${subgraphName}`] = deployment;
  }

  static getEndpointVersion(endpointIndex, subgraphName) {
    return this._endpointVersion[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointVersion(endpointIndex, subgraphName, version) {
    this._endpointVersion[`${endpointIndex}-${subgraphName}`] = version;
    if (this.isStaleVersion(endpointIndex, subgraphName)) {
      // Update timestamp
      this.setLastEndpointStaleVersionTimestamp(endpointIndex, subgraphName);
    }
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
  static async setEndpointBlock(endpointIndex, subgraphName, blockNumber) {
    // Block number cannot decrease unless redeploy/error
    if (blockNumber > (this._endpointBlock[`${endpointIndex}-${subgraphName}`] ?? 0)) {
      this._endpointBlock[`${endpointIndex}-${subgraphName}`] = blockNumber;
    }
    if (!(await this.isInSync(endpointIndex, subgraphName))) {
      // Update timestamp
      this.setLastEndpointOutOfSyncTimestamp(endpointIndex, subgraphName);
    }
  }

  static endpointHasErrors(endpointIndex, subgraphName) {
    return this._endpointHasErrors[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointHasErrors(endpointIndex, subgraphName, value) {
    if (value) {
      // Resets block number on an error
      this._endpointBlock[`${endpointIndex}-${subgraphName}`] = 0;
      // Update timestamp
      this.setLastEndpointErrorTimestamp(endpointIndex, subgraphName);
    }
    this._endpointHasErrors[`${endpointIndex}-${subgraphName}`] = value;
  }

  static endpointHasFatalErrors(endpointIndex, subgraphName) {
    return this._endpointHasFatalErrors[`${endpointIndex}-${subgraphName}`];
  }
  static setEndpointHasFatalErrors(endpointIndex, subgraphName, value) {
    this._endpointHasFatalErrors[`${endpointIndex}-${subgraphName}`] = value;
    this.setEndpointHasErrors(endpointIndex, subgraphName, value);
  }

  static getLastEndpointUsageTimestamp(endpointIndex, subgraphName) {
    return this._endpointTimestamps[`${endpointIndex}-${subgraphName}`]?.usage;
  }
  static getLastEndpointErrorTimestamp(endpointIndex, subgraphName) {
    return this._endpointTimestamps[`${endpointIndex}-${subgraphName}`]?.error;
  }
  static getLastEndpointOutOfSyncTimestamp(endpointIndex, subgraphName) {
    return this._endpointTimestamps[`${endpointIndex}-${subgraphName}`]?.outOfSync;
  }
  static getLastEndpointStaleVersionTimestamp(endpointIndex, subgraphName) {
    return this._endpointTimestamps[`${endpointIndex}-${subgraphName}`]?.staleVersion;
  }

  static setLastEndpointUsageTimestamp(endpointIndex, subgraphName) {
    this.setEndpointTimestamp(endpointIndex, subgraphName, 'usage');
  }
  static setLastEndpointErrorTimestamp(endpointIndex, subgraphName) {
    this.setEndpointTimestamp(endpointIndex, subgraphName, 'error');
  }
  static setLastEndpointOutOfSyncTimestamp(endpointIndex, subgraphName) {
    this.setEndpointTimestamp(endpointIndex, subgraphName, 'outOfSync');
  }
  static setLastEndpointStaleVersionTimestamp(endpointIndex, subgraphName) {
    this.setEndpointTimestamp(endpointIndex, subgraphName, 'staleVersion');
  }

  static setEndpointTimestamp(endpointIndex, subgraphName, timestampName) {
    this._endpointTimestamps[`${endpointIndex}-${subgraphName}`] ??= {};
    this._endpointTimestamps[`${endpointIndex}-${subgraphName}`][timestampName] = new Date();
  }

  // Derived functions
  static getLatestVersion(subgraphName) {
    let versions = [];
    for (const i of EnvUtil.endpointsForSubgraph(subgraphName)) {
      versions.push(this._endpointVersion[`${i}-${subgraphName}`]);
    }
    versions = versions.filter((v) => v !== undefined).sort(SemVerUtil.compareVersions);
    return versions[versions.length - 1];
  }

  static getLatestBlock(subgraphName) {
    let blocks = [];
    for (const i of EnvUtil.endpointsForSubgraph(subgraphName)) {
      blocks.push(this._endpointBlock[`${i}-${subgraphName}`]);
    }
    blocks = blocks.filter((v) => v !== undefined).sort();
    return blocks[blocks.length - 1];
  }

  // Not a perfect assumption - the endpoint is considered in sync if it is within 50 blocks of the chain head.
  static async isInSync(endpointIndex, subgraphName) {
    const chain = this.getEndpointChain(endpointIndex, subgraphName);
    return this.getEndpointBlock(endpointIndex, subgraphName) + 50 > (await ChainState.getChainHead(chain));
  }

  static isStaleVersion(endpointIndex, subgraphName) {
    return (
      SemVerUtil.compareVersions(
        this.getEndpointVersion(endpointIndex, subgraphName),
        this.getLatestVersion(subgraphName)
      ) === -1
    );
  }

  static allHaveErrors(subgraphName) {
    for (const i of EnvUtil.endpointsForSubgraph(subgraphName)) {
      if (!this.endpointHasErrors(i, subgraphName)) {
        return false;
      }
    }
    return true;
  }
}

module.exports = SubgraphState;