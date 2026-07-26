declare global {
    var gtkxHeadlessTeardown: (() => void) | undefined;
    var gtkxHeadlessShutdownInstalled: boolean | undefined;
}

const defineGlobal = (key: string, value: unknown): void => {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
};

export const setHeadlessTeardown = (teardown: (() => void) | undefined): void => {
    defineGlobal("gtkxHeadlessTeardown", teardown);
};

export const headlessTeardown = (): (() => void) | undefined => globalThis.gtkxHeadlessTeardown;

export const setHeadlessShutdownInstalled = (installed: boolean | undefined): void => {
    defineGlobal("gtkxHeadlessShutdownInstalled", installed);
};

export const headlessShutdownInstalled = (): boolean => globalThis.gtkxHeadlessShutdownInstalled === true;
