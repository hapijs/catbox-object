
### Options

- `maxSize` - sets an upper limit on the number of items that can be stored in the
  cache. Once this limit is reached no additional items will be added to the cache
  until some expire. Defaults to `1000`.
- `minCleanupIntervalMsec` - the minimum number of milliseconds in between each cache cleanup.
  Defaults to 1 second (`1000`).