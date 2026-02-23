const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

/**
 * Custom Metro configuration to work around Firebase Auth "Component auth has not been registered yet" error
 * See: https://github.com/firebase/firebase-js-sdk/issues/8988 and https://github.com/expo/expo/issues/36598
 *
 * 1. Adds support for `.cjs` extensions used internally by Firebase JS SDK.
 * 2. Disables `unstable_enablePackageExports`, which currently breaks Firebase Auth on Expo SDK 53 / RN 0.79 with Hermes.
 * 3. Adds web platform resolver for Stripe React Native modules
 */
const config = getDefaultConfig(__dirname);

// Add support for `.cjs` files
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable experimental package exports resolution (causes Firebase component registration failure)
config.resolver.unstable_enablePackageExports = false;

// Exclude admin-panel (Next.js project) from Metro bundler
const adminPanelPath = path.resolve(__dirname, 'admin-panel');
config.resolver.blockList = exclusionList([
  new RegExp(`${adminPanelPath.replace(/\\/g, '\\\\')}.*`),
  /admin-panel\/.*/,
]);

// Exclude admin-panel from file watcher
config.watcher = {
  ...config.watcher,
  watchman: {
    ...config.watcher?.watchman,
    ignore: ['admin-panel'],
  },
  healthCheck: {
    ...config.watcher?.healthCheck,
  },
};

// Ignore admin-panel in resolver
config.resolver.blacklistRE = exclusionList([
  new RegExp(`${adminPanelPath.replace(/\\/g, '\\\\')}.*`),
  /admin-panel\/.*/,
]);

// Web platform resolver for native modules (like Stripe)
config.resolver.platforms = ['web', 'ios', 'android', 'native'];

// Resolve native modules that don't work on web
config.resolver.alias = {
  ...(config.resolver.alias || {}),
  // Mock Stripe React Native for web - use absolute path
  '@stripe/stripe-react-native': path.resolve(__dirname, 'src/utils/stripe-web-mock.js'),
};

// Add resolver for web platform to avoid native module errors
config.resolver.resolverMainFields = ['browser', 'main'];

module.exports = config; 