import { addLogListener, removeLogListener } from "@gtkx/native";

type LogLevel = "error" | "critical" | "warning" | "message" | "info" | "debug";

type LogListener = (level: LogLevel, domain: string, message: string) => void;

type LogSubscription = { unsubscribe(): void };

/**
 * Subscribes to GLib logs from every thread. The listener receives the level, domain, and message.
 * Records reach JavaScript asynchronously; yield to the event loop before checking collected logs.
 *
 * Fatal logs, including levels made fatal by `logSetAlwaysFatal`, abort before delivery and never
 * reach the listener. Unsubscribing stops new records but leaves already queued deliveries intact.
 */
const onLog = (listener: LogListener): LogSubscription => {
    const id = addLogListener(listener);

    return {
        unsubscribe: () => {
            removeLogListener(id);
        },
    };
};

export { onLog, type LogLevel, type LogListener, type LogSubscription };
