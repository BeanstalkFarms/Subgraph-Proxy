# Subgraph Proxy

Reverse Proxy for subgraph requests.

## Why?

This project seeks to mitigate a few different unsolved issues when it comes to subgraphs:

1. Inconsistent results. When making many requests simultaneously, a query result will indicate the subgraph has indexed up to block X, while other times the results will indicate only block X-1 has been indexed.
2. Not always up to date. Sometimes subgraphs can fall behind by several blocks, missing minutes of on-chain data.
3. New deployments. If a new version is deployed as the live/production deployment, it is unsuitable to be queried until it has fully indexed up to the chain head.
4. Downtime. Although infrequent, even with deployments to Graph decentralized network I have observed significant downtime.

The most critical of these issues is the first, but the others are certainly a nuisance.

The above issues are resolved by multiplexing subgraph requests across multiple available deployment environments, and will use results from whichever deployment can satisfy all of the above requirements at the time the query is made.
