import "./bootstrap.js";
import type { ElementType } from "react";
import type { AnimatedComponent } from "./types.js";
import { withAnimated } from "./with-animated.js";

const animated: <T extends Exclude<ElementType, string>>(component: T) => AnimatedComponent<T> = withAnimated;

export { animated };
export type { AnimatedComponent } from "./types.js";
export { withAnimated } from "./with-animated.js";
