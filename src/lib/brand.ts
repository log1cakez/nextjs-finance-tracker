/** Product name and story — King Midas: the golden touch. */
export const APP_NAME = "MIDAS Finance Tracker";

/** `<title>` / browser tab — favicon carries the MIDAS mark. */
export const APP_PAGE_TITLE = "MIDAS Finance Tracker";

/** Header + auth screens; file lives in `/public`. */
export const BRAND_LOGO_LIGHT_PUBLIC_PATH = "/midas logo.webp";
export const BRAND_LOGO_DARK_PUBLIC_PATH = "/midas no bg.png";

export const APP_TAGLINE =
  "Every insight touched with clarity — like Midas turning lead to gold.";

export const APP_DESCRIPTION =
  "Personal finance tracking: accounts, transactions, recurring flows, and dashboards — with Midas clarity for your money.";

export const REGISTER_INTRO =
  "Create an account for your categories, accounts, and transactions — clarity worth its weight in gold.";

/** Site footer — set `NEXT_PUBLIC_APP_AUTHOR_NAME` or edit this default. */
export const APP_AUTHOR_NAME =
  (typeof process.env.NEXT_PUBLIC_APP_AUTHOR_NAME === "string" &&
    process.env.NEXT_PUBLIC_APP_AUTHOR_NAME.trim()) ||
  "Your name";

export const APP_FOOTER_DISCLAIMER =
  "Not for commercial use. This app is for personal, non-commercial use only. All data in this system is encrypted; it cannot be tampered with, changed, modified, or viewed by the developer. No warranty is provided; use at your own risk.";
