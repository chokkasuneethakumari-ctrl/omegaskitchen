// Config plugin: build the Android app for arm64-v8a only.
//
// EAS produces a "universal" APK by default, bundling native libraries for four CPU
// architectures (arm64-v8a, armeabi-v7a, x86, x86_64). Every phone shipped in the last
// several years is arm64-v8a, so restricting to it roughly halves the native-code weight
// of the APK with no functional impact on real devices. This sets the gradle property
// that React Native's gradle plugin reads to decide which ABIs to compile.
const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withArm64Only(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;
    const existing = props.find(
      (p) => p.type === "property" && p.key === "reactNativeArchitectures"
    );
    if (existing) {
      existing.value = "arm64-v8a";
    } else {
      props.push({ type: "property", key: "reactNativeArchitectures", value: "arm64-v8a" });
    }
    return cfg;
  });
};
