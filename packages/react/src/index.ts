export { createRef } from "@gtkx/ffi";
/**
 * @private Internal symbol used to identify the root container node.
 * This is an internal API used only by @gtkx/testing. Do not use directly.
 */
export { ROOT_NODE_CONTAINER } from "./factory.js";
export * from "./generated/jsx.js";
export { createPortal } from "./portal.js";
export { reconciler } from "./reconciler.js";
export { render } from "./render.js";

import { stop } from "@gtkx/ffi";
import type { ReactNode } from "react";
import { reconciler } from "./reconciler.js";
import { container } from "./render.js";

/**
 * Updates the React tree without restarting the GTK application.
 * Used for hot module replacement (HMR) during development.
 *
 * @param element - The new root React element to render
 * @throws Error if called before render()
 */
export const update = (element: ReactNode): void => {
    if (!container) {
        throw new Error("Cannot update before render() is called");
    }
    reconciler.getInstance().updateContainer(element, container, null, () => {});
};

/**
 * Quits the GTK application and cleans up resources.
 * Unmounts the React tree and stops the GTK main loop.
 * @returns Always returns true (useful for signal handlers)
 */
export const quit = () => {
    if (container) {
        reconciler.getInstance().updateContainer(null, container, null, () => {
            setTimeout(() => {
                stop();
            }, 0);
        });
    }

    return true;
};
