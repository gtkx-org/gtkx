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

export let screen: RenderResult = defaultScreen;

export const setScreen = (result: RenderResult): void => {
    screen = result;
};

export const clearScreen = (): void => {
    screen = defaultScreen;
};
