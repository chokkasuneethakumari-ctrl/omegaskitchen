// Required by Metro/Expo. Was missing from the Emergent export.
// babel-preset-expo (SDK 54) handles JSX, expo-router, and AUTO-injects
// react-native-worklets/plugin (the reanimated v4 transform) because
// react-native-worklets is installed — so do NOT add that plugin here,
// or Babel will error on a duplicate plugin.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
