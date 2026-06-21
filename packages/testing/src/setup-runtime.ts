import type { GApplication } from "@gtkx/ffi";
import { setApplicationLifecycle } from "@gtkx/react";
import { act, runWithActEnvironment } from "./act.js";
import { configure } from "./config.js";

const drainMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

configure({
    asyncWrapper: <T>(callback: () => Promise<T>): Promise<T> =>
        Promise.resolve(
            runWithActEnvironment(false, async () => {
                const result = await callback();
                await drainMicrotasks();
                return result;
            }),
        ),
    eventWrapper: (callback: () => void): Promise<void> => Promise.resolve(act(() => callback())).then(),
});

setApplicationLifecycle({
    run: (application: GApplication) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
