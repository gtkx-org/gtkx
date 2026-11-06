import type * as GObject from "@gtkx/gi/gobject";
import { offSignal, onSignal } from "@gtkx/runtime";
import { useLayoutEffect } from "react";
import { isDevelopment, warnDismissal, watchDismissal } from "../utils/dismissal.js";
import { useLatestRef } from "./use-latest-ref.js";

/** Warns in development when the toolkit reports, through `close-attempt`, a close GTKX refused for the app. */
const useRefusedCloseWarning = (
    object: GObject.Object | null,
    isRefusing: boolean,
    key: string,
    message: () => string,
): void => {
    const messageRef = useLatestRef(message);

    useLayoutEffect(() => {
        if (object === null || !isRefusing || !isDevelopment()) {
            return;
        }

        const warn = (): void => {
            warnDismissal(key, messageRef.current());
        };

        onSignal(object, "close-attempt", warn);

        return () => {
            offSignal(object, "close-attempt", warn);
        };
    }, [object, isRefusing, key, messageRef]);
};

/**
 * Warns in development when the user dismisses a rendered object through `signal` and, once the app's handlers
 * ran, `check` still finds it open in React. The check never runs after the component unmounts.
 */
const useDismissalWatch = (
    object: GObject.Object | null,
    signal: string,
    key: string,
    check: () => string | null,
): void => {
    const checkRef = useLatestRef(check);

    useLayoutEffect(() => {
        if (object === null || !isDevelopment()) {
            return;
        }

        return watchDismissal(object, signal, key, () => checkRef.current());
    }, [object, signal, key, checkRef]);
};

export { useDismissalWatch, useRefusedCloseWarning };
