import { installGracefulShutdown } from "@gtkx/utils";

declare global {
    var gtkxHeadlessTeardown: (() => void) | undefined;
    var gtkxHeadlessShutdownInstalled: boolean | undefined;
}

export const installHeadlessShutdown = (): void => {
    const teardown = globalThis.gtkxHeadlessTeardown;
    if (teardown === undefined || globalThis.gtkxHeadlessShutdownInstalled === true) return;
    globalThis.gtkxHeadlessShutdownInstalled = true;
    installGracefulShutdown({ onSignal: teardown });
};

installHeadlessShutdown();
