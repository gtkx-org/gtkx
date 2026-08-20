import type { Demo } from "./types.js";
import { chainDemo } from "./chain.js";
import { imperativeDemo } from "./imperative.js";
import { interpolationDemo } from "./interpolation.js";
import { reducedMotionDemo } from "./reduced-motion.js";
import { springsListDemo } from "./springs-list.js";
import { springsDemo } from "./springs.js";
import { trailDemo } from "./trail.js";
import { transformsDemo } from "./transforms.js";
import { transitionsDemo } from "./transitions.js";

const demos: Demo[] = [
    springsDemo,
    interpolationDemo,
    springsListDemo,
    trailDemo,
    transitionsDemo,
    chainDemo,
    imperativeDemo,
    transformsDemo,
    reducedMotionDemo,
];

export { demos };
