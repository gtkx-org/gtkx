import { constants } from "node:os";

function exitCodeForSignal(signal: NodeJS.Signals | null): number {
    return signal === null ? 0 : 128 + constants.signals[signal];
}

export { exitCodeForSignal };
