export { createRef } from "@gtkx/ffi";
export * from "./generated/jsx.js";
export { createPortal } from "./portal.js";
export { render } from "./render.js";

import { stop } from "@gtkx/ffi";
import { disposeAllInstances, reconciler } from "./reconciler.js";
import { container } from "./render.js";

/**
 * Quits the GTK application and cleans up resources.
 * Unmounts the React tree and stops the GTK main loop.
 * @returns Always returns false (useful for signal handlers)
 */
export const quit = () => {
    reconciler.updateContainer(null, container, null, () => {
        disposeAllInstances();
        stop();
    });

    return false;
};
