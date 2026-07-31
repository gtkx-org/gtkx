function isSameArrayBy<T>(a: T[], b: T[], isEqual: (x: T, y: T) => boolean): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((item, index) => isEqual(item, b[index] as T));
}

export { isSameArrayBy };
