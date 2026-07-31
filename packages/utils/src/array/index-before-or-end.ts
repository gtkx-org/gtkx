const indexBeforeOrEnd = <T, B>(
    list: T[],
    before: B | null,
    isMatch: (item: T, before: B) => boolean,
): number => {
    if (before === null) {
        return list.length;
    }

    const index = list.findIndex((item) => isMatch(item, before));

    return index === -1 ? list.length : index;
};

export { indexBeforeOrEnd };
