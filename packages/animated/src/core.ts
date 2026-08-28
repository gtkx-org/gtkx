import "./bootstrap.js";
import type { ElementType } from "react";
import type { AnimatedComponent } from "./types.js";
import { withAnimated } from "./with-animated.js";

/**
 * The callable half of the `animated` surface: wraps a component so its props accept springs and
 * interpolations, without the property form and therefore without importing the generated widget
 * components. The rewrite the CLI applies to `animated.GtkX` member accesses resolves here, so a
 * bundle that never uses `animated` dynamically carries only the widgets it renders.
 */
const animated: <T extends Exclude<ElementType, string>>(component: T) => AnimatedComponent<T> = withAnimated;

export { animated, withAnimated };
export type { AnimatedComponent } from "./types.js";
