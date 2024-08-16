# Subgraph Proxy

Reverse Proxy for subgraph requests.

## Why?

This project seeks to mitigate a few different unsolved issues when it comes to subgraphs:

1. Inconsistent results. When making many requests simultaneously, a query result will indicate the subgraph has indexed up to block X, while other times the results will indicate only block X-1 has been indexed.
2. Not always up to date. Sometimes subgraphs can fall behind by several blocks, which can be several minutes.
3. Downtime. Although highly infrequently, even with deployments to Graph decentralized network I have observed significant downtime.

The most critical of these issues is the first, but the others are certainly a nuisance.

This project seeks to multiplex subgraph requests across multiple available deployment environments, and will use results from whichever deployment can satisfy all of the above requirements at the time the query is made.
