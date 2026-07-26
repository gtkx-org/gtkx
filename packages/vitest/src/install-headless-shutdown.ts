import { installGracefulShutdown } from "@gtkx/utils";
import { headlessShutdownInstalled, headlessTeardown, setHeadlessShutdownInstalled } from "./headless-globals.js";

export const installHeadlessShutdown = (): void => {
    const teardown = headlessTeardown();
    if (teardown === undefined || headlessShutdownInstalled()) return;
    setHeadlessShutdownInstalled(true);
    installGracefulShutdown({ onSignal: teardown });
};
