import type { ElementType } from "react";
import type { AnimatedComponent } from "./types.js";
import { withAnimated } from "./with-animated.js";

/** Callable entrypoint that wraps a component with animated props. */
type Animated = <T extends Exclude<ElementType, string>>(component: T) => AnimatedComponent<T>;

/**
 * Wraps a component so its mutable props accept springs and interpolations. Construct-only props
 * keep their original types. Each frame writes animated GObject properties, a label's text children and `style`
 * to the native object through its `ref` without a React render; other animated props, or a component
 * that does not forward its `ref`, re-render with the current values. The wrapper of a given component
 * is created once and reused.
 */
const animated: Animated = withAnimated;

export { animated, type Animated };
