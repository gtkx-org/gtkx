import { installGracefulShutdown } from "@gtkx/utils";
import { headlessShutdownInstalled, headlessTeardown, setHeadlessShutdownInstalled } from "./headless-globals.js";

const installHeadlessShutdown = (): void => {
    const teardown = headlessTeardown();

    if (teardown === undefined || headlessShutdownInstalled()) {
        return;
    }

    setHeadlessShutdownInstalled(true);
    installGracefulShutdown({ onSignal: teardown });
};

export { installHeadlessShutdown };
