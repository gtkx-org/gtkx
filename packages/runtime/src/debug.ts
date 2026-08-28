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

function warnOnce(key: string, message: string): void {
    if (seen.has(key) || !isEnabled()) {
        return;
    }

    seen.add(key);
    console.warn(`[gtkx] ${message}`);
}

export { warnOnce };
