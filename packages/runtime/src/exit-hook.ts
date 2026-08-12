import { quit } from "./lifecycle.js";

const TERMINATION_SIGNALS: NodeJS.Signals[] = ["SIGHUP", "SIGINT", "SIGTERM"];

const isSoleHandler = (signal: NodeJS.Signals): boolean => process.listenerCount(signal) === 1;

const quitOnSignal = (signal: NodeJS.Signals): void => {
    if (!isSoleHandler(signal)) {
        return;
    }

    quit();
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
};

process.on("exit", quit);

for (const signal of TERMINATION_SIGNALS) {
    process.on(signal, quitOnSignal);
}
