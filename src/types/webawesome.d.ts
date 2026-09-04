/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { CustomElements, CustomCssProperties } from "@awesome.me/webawesome/dist/custom-elements-jsx.d.ts";

type WithSuppressHydrationWarning<T> = {
  [K in keyof T]: T[K] & { suppressHydrationWarning?: boolean };
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements extends WithSuppressHydrationWarning<CustomElements> {}
  }
  interface CSSProperties extends CustomCssProperties {}
}
