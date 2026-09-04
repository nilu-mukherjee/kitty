/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { CustomElements, CustomCssProperties } from "@awesome.me/webawesome/dist/custom-elements-jsx.d.ts";

// The library's own custom-elements-jsx.d.ts also declares `declare module "react" {
// interface IntrinsicElements extends CustomElements {} }` (unwrapped, no
// suppressHydrationWarning). That declaration merges with this one; an `extends`-only
// (empty-body) interface here would silently lose to the library's version instead of
// erroring, because `extends`-derived members don't take precedence over each other.
// Explicit *own* members below do take precedence over inherited ones, so we redeclare
// each tag actually used in the app individually rather than mapping over all of
// CustomElements.
type SuppressHydration<T> = T & { suppressHydrationWarning?: boolean };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wa-badge": SuppressHydration<CustomElements["wa-badge"]>;
      "wa-button": SuppressHydration<CustomElements["wa-button"]>;
      "wa-callout": SuppressHydration<CustomElements["wa-callout"]>;
      "wa-card": SuppressHydration<CustomElements["wa-card"]>;
      "wa-details": SuppressHydration<CustomElements["wa-details"]>;
      "wa-icon": SuppressHydration<CustomElements["wa-icon"]>;
      "wa-input": SuppressHydration<CustomElements["wa-input"]>;
      "wa-skeleton": SuppressHydration<CustomElements["wa-skeleton"]>;
      "wa-spinner": SuppressHydration<CustomElements["wa-spinner"]>;
      "wa-toast": SuppressHydration<CustomElements["wa-toast"]>;
      "wa-tooltip": SuppressHydration<CustomElements["wa-tooltip"]>;
    }
  }
  interface CSSProperties extends CustomCssProperties {}
}
