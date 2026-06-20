import type { RenderResult } from "./types.js";

const NO_RENDER_MESSAGE = "No render has been performed: call render() before using screen queries";

const throwNoRender = (): never => {
    throw new Error(NO_RENDER_MESSAGE);
};

const defaultScreen: RenderResult = new Proxy({} as RenderResult, {
    get: (_target, property) => {
        if (property === "baseElement" || property === "container") return throwNoRender();
        return throwNoRender;
    },
});

/**
 * Global query object for accessing rendered components.
 *
 * Holds the most recent {@link render} result, so its queries, `debug`,
 * `logRoles`, and `screenshot` operate against the latest mount without
 * re-binding. Accessing any member before a render — or after `cleanup` —
 * throws, directing the caller to render first.
 *
 * @example
 * ```tsx
 * import { render, screen } from "@gtkx/testing";
 *
 * test("finds button", async () => {
 *   await render(<MyComponent />);
 *   const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
 *   expect(button).toBeDefined();
 * });
 * ```
 *
 * @see {@link render} for rendering components
 * @see {@link within} for scoped queries
 */
export let screen: RenderResult = defaultScreen;

/** Points `screen` at a fresh {@link render} result; called by `render`. */
export const setScreen = (result: RenderResult): void => {
    screen = result;
};

/** Resets `screen` to its pre-render state; called by `cleanup`. */
export const clearScreen = (): void => {
    screen = defaultScreen;
};
