/** The business name shown throughout the shell — sidebar, login, splash,
 * page title, logout prompt, backup messages. Defined ONCE here: the rename
 * away from the old name was previously done in the sidebar only, leaving the login
 * page, the browser tab, the backup errors and the home-screen icon label
 * all still saying the old name. Keep public/manifest.webmanifest in step by
 * hand — a static JSON file can't import this. */
export const APP_NAME = "Mintten";

/** The strapline under the logo. Kept apart from APP_NAME because the two are
 * used differently: sentences ("Logout from Mintten?") want the bare name,
 * while the browser tab, the installed-app label and the brand lockup want
 * the full "Mintten Professional". */
export const APP_TAGLINE = "Professional";

/** Full brand lockup as one string — browser tab, OG tags, install prompt. */
export const APP_FULL_NAME = `${APP_NAME} ${APP_TAGLINE}`;

/** Bump on every deploy — shown on the login page and Settings so we can
 * always tell which version a user is actually running. */
export const APP_VERSION = "10 Sep 2026 · v85";
