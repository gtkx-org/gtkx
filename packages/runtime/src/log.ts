import { addLogListener, removeLogListener } from "@gtkx/native";

type LogLevel = "error" | "critical" | "warning" | "message" | "info" | "debug";
type LogListener = (level: LogLevel, domain: string, message: string) => void;
type LogSubscription = { unsubscribe(): void };

const onLog = (listener: LogListener): LogSubscription => {
    const id = addLogListener(listener);

    return {
        unsubscribe: () => {
            removeLogListener(id);
        },
    };
};

export { type LogLevel, type LogListener, type LogSubscription, onLog };
