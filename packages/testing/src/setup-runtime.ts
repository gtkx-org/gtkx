import type { ApplicationRunner } from "@gtkx/ffi";
import { setApplicationLifecycle } from "@gtkx/react";

setApplicationLifecycle({
    run: (application: ApplicationRunner) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
