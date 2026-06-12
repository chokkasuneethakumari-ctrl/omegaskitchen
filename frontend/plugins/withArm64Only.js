// Config plugin: restrict the Android build to the two ARM ABIs that real phones use.
//
// EAS produces a "universal" APK that bundles native libraries for four CPU architectures
// (armeabi-v7a, arm64-v8a, x86, x86_64). The x86 ABIs are only used by emulators, so we drop
// them to keep the APK lean — but we keep BOTH ARM ABIs: arm64-v8a (modern 64-bit phones) AND
// armeabi-v7a (older / budget 32-bit phones). Shipping arm64 alone makes 32-bit devices report
// "app not compatible" and fail to install, so both ARM ABIs are required for universal phone
// support. (Filename kept for app.json compatibility; it now targets both ARM ABIs.)
const { withGradleProperties } = require("@expo/config-plugins");

const ANDROID_ABIS = "armeabi-v7a,arm64-v8a";

module.exports = function withAndroidAbis(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures"
    );
    if (existing) {
      existing.value = ANDROID_ABIS;
    } else {
      props.push({ type: "property", key: "reactNativeArchitectures", value: ANDROID_ABIS });
    }
    return cfg;
  });
};
