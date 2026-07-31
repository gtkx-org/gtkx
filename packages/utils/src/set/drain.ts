const drain = <T>(set: Set<T>, visit: (item: T) => void): void => {
    for (const item of set) {
        visit(item);
    }

    set.clear();
};

export { drain };
