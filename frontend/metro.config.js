// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];


// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

// Expo Go can't load `react-native-keyboard-controller` (a custom native module
// that isn't part of the Expo Go runtime). When Metro is started with EXPO_GO=1,
// alias that package to a lightweight RN-based stub (stubs/keyboard-controller.js)
// so the app runs in Expo Go. Leave EXPO_GO unset for real dev/production builds
// to use the real native module.
if (process.env.EXPO_GO === "1") {
  const kcStub = path.resolve(__dirname, "stubs/keyboard-controller.js");
  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-keyboard-controller") {
      return { type: "sourceFile", filePath: kcStub };
    }
    return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
