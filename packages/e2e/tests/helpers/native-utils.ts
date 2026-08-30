function forceGC(): void {
    if (!globalThis.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }

    globalThis.gc();
}

async function gcUntil(isSatisfied: () => boolean, maxRounds = 100): Promise<void> {
    for (let round = 0; round < maxRounds; round++) {
        if (isSatisfied()) {
            return;
        }

        await new Promise((resolve) => setImmediate(resolve));
        forceGC();
        await new Promise((resolve) => setImmediate(resolve));
    }
}

export { gcUntil };
