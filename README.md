# @refrens/gst-states

India GST state codes: an object mapping the two-digit GSTN state code to the state name.

## Usage

### npm (GitHub Packages)

Published to GitHub Packages as `@refrens/gst-states`. Add `@refrens:registry=https://npm.pkg.github.com` to `.npmrc` with a token that can read Refrens packages, then:

`npm i @refrens/gst-states`

```js
import gstStates from '@refrens/gst-states';

gstStates['27']; // 'Maharashtra'
```

Versions up to 2.1.1 were also published to npmjs as `gst-states`; that name is no longer maintained by Refrens.

### Release

`npm run release` on `master` (guarded by `scripts/guard-release.js`), `npm run release:canary <id>` from a branch.

### CDN

The gst state codes can also be accessed via CDN at

`https://cdn.jsdelivr.net/gh/refrens/gst-states/index.json`

### License

The code in this repository is licensed under the MIT License. License text is available in the `LICENSE` file.
