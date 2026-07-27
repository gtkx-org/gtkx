/**
 * Maps a terminating signal to its conventional process exit code (130 for `SIGINT`, 143 otherwise),
 * or 0 when no signal is given.
 *
 * @param signal - The signal that triggered termination, or `null`.
 * @returns The conventional exit code for the signal.
 *
 * @example
 * exitCodeForSignal("SIGINT"); // 130
 * exitCodeForSignal(null); // 0
 */
function exitCodeForSignal(signal: NodeJS.Signals | null): number {
    if (!signal) {
        return 0;
    }

    return signal === "SIGINT" ? 130 : 143;
}

export { exitCodeForSignal };
