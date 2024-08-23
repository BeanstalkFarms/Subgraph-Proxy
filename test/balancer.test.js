// Strategy
// 1. If in blacklist or isBurstDepleted, avoid outright
// 2. If the subgraph has errors, is out of sync, or is not on the latest version,
//    avoid unless some time has passed since last result
// 3. If there are still multiple to choose from:
//  a. do not prefer according to (b) or (c) if >100% utilization for the endpoint they would choose
//  b. if an endpoint is in history but not blacklist, prefer that one again if its block >= the chain head
//  c. if both have a result within the last second, prefer one having a later block
//  d. prefer according to utilization

describe('Endpoint Balancer', () => {
  test('Blacklisted endpoints are not selected', async () => {});
  test('Subgraphs with errors are not selected unless time elapsed', async () => {});
  test('Subgraphs out of sync are not selected unless time elapsed', async () => {});
  test('Subgraphs on older version are not selected unless time elapsed', async () => {});

  test('<100% utilized: Underutilized endpoint is chosen', async () => {});
  test('<100% utilized: Endpoint is not selected due to exceeding utilization preference cap', async () => {});
  test('<100% utilized: Endpoint with latest block result is chosen', async () => {});
  test('<100% utilized: History endpoint is re-queried', async () => {});
  test('<100% utilized: History endpoint is not re-queried', async () => {});

  test('>=100% utilized: lesser utilized endpoint is chosen', async () => {});
  test('>=100% utilized: no endpoint can be chosen', async () => {});
});
