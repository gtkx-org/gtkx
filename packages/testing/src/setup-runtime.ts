import type { ApplicationRunner } from "@gtkx/ffi";
import { setApplicationLifecycle } from "@gtkx/react";
import { act, getIsReactActEnvironment, setIsReactActEnvironment } from "./act.js";
import { configure } from "./config.js";

const drainMicrotasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

configure({
    asyncWrapper: async <T>(callback: () => Promise<T>): Promise<T> => {
        const previousActEnvironment = getIsReactActEnvironment();
        setIsReactActEnvironment(false);
        try {
            const result = await callback();
            await drainMicrotasks();
            return result;
        } finally {
            setIsReactActEnvironment(previousActEnvironment);
        }
    },
    eventWrapper: (callback: () => void): void => {
        void act(() => {
            callback();
        });
    },
});

setApplicationLifecycle({
    run: (application: ApplicationRunner) => {
        application.on("activate", () => {});
        if (!application.getIsRegistered()) application.register(null);
        application.activate();
    },
    quit: () => {},
});
