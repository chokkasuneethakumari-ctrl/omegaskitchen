// True only in the dedicated admin build. The eas.json "admin" build profile sets
// EXPO_PUBLIC_APP_VARIANT=admin, which is inlined into the bundle at build time; the
// customer build leaves it unset. Used to present a staff-only entry and to refuse
// non-administrator sign-ins in the admin app.
export const IS_ADMIN_APP = process.env.EXPO_PUBLIC_APP_VARIANT === "admin";
