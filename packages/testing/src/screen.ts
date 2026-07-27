import type { RenderResult, Screen } from "./bound-queries.js";

const NO_RENDER_MESSAGE = "No render has been performed: call render() before using screen queries";

const defaultScreen: RenderResult = new Proxy({} as RenderResult, {
    get: (_target, property) => {
        if (property === "baseElement" || property === "container") {
            return throwNoRender();
        }

        return throwNoRender;
    },
});

const activeScreen: { current: RenderResult } = { current: defaultScreen };

/**
 * Queries and debug utilities bound to the most recent render, scoped to the
 * current toplevel windows. Accessing it before any render throws.
 */
const screen: Screen = new Proxy({} as Screen, {
    get: (_target, property): unknown => Reflect.get(activeScreen.current, property),
});

const throwNoRender = (): never => {
    throw new Error(NO_RENDER_MESSAGE);
};

const setScreen = (result: RenderResult): void => {
    activeScreen.current = result;
};

const clearScreen = (): void => {
    activeScreen.current = defaultScreen;
};

export { screen, setScreen, clearScreen };
