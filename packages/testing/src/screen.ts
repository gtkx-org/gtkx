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

let activeScreen: RenderResult = defaultScreen;

export const screen: RenderResult = new Proxy({} as RenderResult, {
    get: (_target, property) => Reflect.get(activeScreen, property),
});

export const setScreen = (result: RenderResult): void => {
    activeScreen = result;
};

export const clearScreen = (): void => {
    activeScreen = defaultScreen;
};
