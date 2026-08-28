const seen: Set<string> = new Set();

const isEnabled = (): boolean => {
    const flag = process.env.GTKX_DIAGNOSTICS;

    if (flag === "1") {
        return true;
    }

    if (flag === "0") {
        return false;
    }

    return process.env.NODE_ENV !== "production";
};

/**
 * Reports a recoverable degradation once per key, so a registry miss or a silently skipped
 * override is loud during development without flooding the output. Enabled outside production
 * builds; `GTKX_DIAGNOSTICS=1` forces it on and `GTKX_DIAGNOSTICS=0` forces it off.
 *
 * @param key Deduplication key; later calls with the same key are dropped.
 * @param message What degraded and what to do about it.
 */
function warnOnce(key: string, message: string): void {
    if (seen.has(key) || !isEnabled()) {
        return;
    }

    seen.add(key);
    console.warn(`[gtkx] ${message}`);
}

export { warnOnce };
