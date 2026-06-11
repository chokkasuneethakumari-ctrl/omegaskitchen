// Dynamic Expo configuration.
//
// The customer app uses app.json exactly as written. Building with
// EXPO_PUBLIC_APP_VARIANT=admin (the eas.json "admin" profile) produces a distinct,
// standalone administrator app from the same source tree — its own display name,
// Android application id and deep-link scheme — so the two can be installed and
// distributed entirely independently while sharing one codebase.
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APP_VARIANT !== "admin") return config;
  return {
    ...config,
    name: "Omega's Kitchen Admin",
    scheme: "omegaadmin",
    android: {
      ...config.android,
      package: "com.omegaskitchen.admin",
    },
  };
};
