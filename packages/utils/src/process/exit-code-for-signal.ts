function exitCodeForSignal(signal: NodeJS.Signals | null): number {
    if (!signal) {
        return 0;
    }

    return signal === "SIGINT" ? 130 : 143;
}

export { exitCodeForSignal };
