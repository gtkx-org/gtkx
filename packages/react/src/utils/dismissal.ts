import type * as GObject from "@gtkx/gi/gobject";
import { getInstanceType, offSignal, onSignal, typeName } from "@gtkx/runtime";
import { createLogger, type Logger } from "@gtkx/utils";
import type { Props } from "../reconciler/registry.js";
import { isApplyingWrite } from "../reconciler/signals.js";

const log: Logger = createLogger("react");
const warned: Set<string> = new Set();

const isDevelopment = (): boolean => process.env.NODE_ENV !== "production";

const warnDismissal = (key: string, message: string): void => {
    if (warned.has(key)) {
        return;
    }

    warned.add(key);
    log.warn(message);
};

const typeNameOf = (object: GObject.Object): string => typeName(getInstanceType(object)) ?? "GObject";

const describeElement = (object: GObject.Object, props: Props): string => {
    const title = props.title;

    return typeof title === "string" && title !== ""
        ? `<${typeNameOf(object)} title="${title}">`
        : `<${typeNameOf(object)}>`;
};

/**
 * Warns in development, once per key, when a native dismissal the toolkit reports through `signal` leaves the
 * app still rendering the element open. The check runs after the app's own handlers and the commit they cause;
 * it returns the warning, or `null` when the app answered. Dismissals GTKX itself performs are ignored.
 */
const watchDismissal = (
    object: GObject.Object,
    signal: string,
    key: string,
    check: () => string | null,
): (() => void) => {
    let isWatching = true;
    const handler = (): void => {
        if (isApplyingWrite()) {
            return;
        }

        setTimeout(() => {
            const message = isWatching ? check() : null;

            if (message !== null) {
                warnDismissal(key, message);
            }
        }, 0);
    };

    onSignal(object, signal, handler);

    return () => {
        isWatching = false;
        offSignal(object, signal, handler);
    };
};

export { describeElement, isDevelopment, typeNameOf, warnDismissal, watchDismissal };
