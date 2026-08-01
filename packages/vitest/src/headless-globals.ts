declare global {
    var gtkxHeadlessTeardown: (() => void) | undefined;
    var isGtkxHeadlessShutdownInstalled: boolean | undefined;
}

const defineGlobal = (key: string, value: unknown): void => {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
};

const setHeadlessTeardown = (teardown: (() => void) | undefined): void => {
    defineGlobal("gtkxHeadlessTeardown", teardown);
};

const headlessTeardown = (): (() => void) | undefined => globalThis.gtkxHeadlessTeardown;

const setHeadlessShutdownInstalled = (installed: boolean | undefined): void => {
    defineGlobal("isGtkxHeadlessShutdownInstalled", installed);
};

const isHeadlessShutdownInstalled = (): boolean => globalThis.isGtkxHeadlessShutdownInstalled === true;

export { setHeadlessTeardown, headlessTeardown, setHeadlessShutdownInstalled, isHeadlessShutdownInstalled };
