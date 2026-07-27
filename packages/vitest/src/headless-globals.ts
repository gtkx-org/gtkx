declare global {
    var gtkxHeadlessTeardown: (() => void) | undefined;
    var gtkxHeadlessShutdownInstalled: boolean | undefined;
}

const defineGlobal = (key: string, value: unknown): void => {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
};

const setHeadlessTeardown = (teardown: (() => void) | undefined): void => {
    defineGlobal("gtkxHeadlessTeardown", teardown);
};

const headlessTeardown = (): (() => void) | undefined => globalThis.gtkxHeadlessTeardown;

const setHeadlessShutdownInstalled = (installed: boolean | undefined): void => {
    defineGlobal("gtkxHeadlessShutdownInstalled", installed);
};

const isHeadlessShutdownInstalled = (): boolean => globalThis.gtkxHeadlessShutdownInstalled === true;

export { setHeadlessTeardown, headlessTeardown, setHeadlessShutdownInstalled, isHeadlessShutdownInstalled };
