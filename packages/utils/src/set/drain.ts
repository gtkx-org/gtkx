const drain = <T>(set: Set<T>, visit: (item: T) => void): void => {
    const errors: unknown[] = [];

    try {
        for (const item of set) {
            try {
                visit(item);
            } catch (error) {
                errors.push(error);
            }
        }
    } finally {
        set.clear();
    }

    if (errors.length === 1) {
        throw errors[0];
    }

    if (errors.length > 1) {
        throw new AggregateError(errors, "Multiple drained operations failed");
    }
};

export { drain };
