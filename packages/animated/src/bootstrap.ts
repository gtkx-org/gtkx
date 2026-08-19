import { Globals } from "@react-spring/core";
import { colors, createStringInterpolator } from "@react-spring/shared";
import { trackReducedMotion } from "./reduced-motion.js";
import { requestFrame } from "./request-frame.js";

Globals.assign({
    colors,
    createStringInterpolator,
    requestAnimationFrame: requestFrame,
});

trackReducedMotion();
