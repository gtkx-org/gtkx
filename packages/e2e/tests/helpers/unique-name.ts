function createCounter(): () => number {
    let next = 0;

    return (): number => {
        next += 1;

        return next;
    };
}

function createAppIdFactory(prefix: string): () => string {
    const nextIndex = createCounter();

    return (): string => `${prefix}${String(nextIndex())}`;
}

function createTypeNameFactory(infix: string): (prefix: string) => string {
    const nextIndex = createCounter();

    return (prefix: string): string => `${prefix}${infix}${String(process.pid)}_${String(nextIndex())}`;
}

export { createAppIdFactory, createTypeNameFactory };
