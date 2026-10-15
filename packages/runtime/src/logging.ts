import { installLogSink, logSubscriptionFence } from "./native.js";

type LogLevel = "error" | "critical" | "warning" | "message" | "info" | "debug";

type LogListener = (level: LogLevel, domain: string, message: string) => void;

type LogSubscription = { unsubscribe(): void };

type Subscription = {
    listener: LogListener;
    start: bigint;
    end?: bigint;
};

const subscriptions = new Map<symbol, Subscription>();
let installed = false;

const deliver = (sequence: bigint, level: LogLevel | "fence", domain: string, message: string): void => {
    if (level === "fence") {
        for (const [id, subscription] of subscriptions) {
            if (subscription.end !== undefined && subscription.end <= sequence) {
                subscriptions.delete(id);
            }
        }
        return;
    }

    const errors: unknown[] = [];
    for (const subscription of subscriptions.values()) {
        if (sequence <= subscription.start || (subscription.end !== undefined && sequence >= subscription.end)) {
            continue;
        }
        try {
            subscription.listener(level, domain, message);
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.length === 1) {
        throw errors[0];
    }

    if (errors.length > 1) {
        throw new AggregateError(errors, "GLib log listeners failed");
    }
};

const createSubscription = (id: symbol): LogSubscription => ({
    unsubscribe: () => {
        const subscription = subscriptions.get(id);
        if (subscription !== undefined && subscription.end === undefined) {
            subscription.end = logSubscriptionFence();
        }
    },
});

/**
 * Subscribes to GLib logs from every thread. The listener receives the level, domain, and message.
 * Records reach JavaScript asynchronously; yield to the event loop before checking collected logs.
 * Listener errors are thrown after every listener receives the record; multiple errors become an
 * `AggregateError`.
 *
 * Fatal logs, including levels made fatal by `logSetAlwaysFatal`, abort before delivery and never
 * reach the listener. Unsubscribing stops new records but leaves already queued deliveries intact.
 */
const onLog = (listener: LogListener): LogSubscription => {
    if (!installed) {
        installLogSink(deliver);
        installed = true;
    }
    const id = Symbol();
    subscriptions.set(id, { listener, start: logSubscriptionFence() });
    return createSubscription(id);
};

export { onLog, type LogLevel, type LogListener, type LogSubscription };
