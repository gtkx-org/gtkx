const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const drainGC = async (rounds = 3): Promise<void> => {
    const collect = globalThis.gc;

    if (collect === undefined) {
        throw new Error("Native E2E tests require --expose-gc");
    }

    for (let round = 0; round < rounds; round++) {
        await settle();
        collect();
        await settle();
    }
};

const didSettle = async (isSatisfied: () => boolean | Promise<boolean>, rounds = 30): Promise<boolean> => {
    for (let round = 0; round < rounds; round++) {
        if (await isSatisfied()) {
            return true;
        }

        await drainGC(1);
    }

    return isSatisfied();
};

export { didSettle, drainGC };
