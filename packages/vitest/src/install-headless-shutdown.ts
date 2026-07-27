import { installGracefulShutdown } from "@gtkx/utils";
import { headlessTeardown, isHeadlessShutdownInstalled, setHeadlessShutdownInstalled } from "./headless-globals.js";

const installHeadlessShutdown = (): void => {
    const teardown = headlessTeardown();

    if (teardown === undefined || isHeadlessShutdownInstalled()) {
        return;
    }

    setHeadlessShutdownInstalled(true);
    installGracefulShutdown({ onSignal: teardown });
};

export { installHeadlessShutdown };
