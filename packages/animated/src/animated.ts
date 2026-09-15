import type { ElementType } from "react";
import type { AnimatedComponent } from "./types.js";
import { withAnimated } from "./with-animated.js";

/** Callable entrypoint that wraps a component with animated props. */
type Animated = <T extends Exclude<ElementType, string>>(component: T) => AnimatedComponent<T>;

/**
 * Wraps a component so its mutable props accept springs and interpolations. Construct-only props
 * keep their original types. Animated values are written to the widget on each frame without a
 * React render. The wrapper of a given component is created once and reused.
 */
const animated: Animated = withAnimated;

export { animated, type Animated };
