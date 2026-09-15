const UNDERSCORE = "_";

const getUnsuffixedName = (name: string): string => {
    let end = name.length;

    while (end > 0 && name.charAt(end - 1) === UNDERSCORE) {
        end -= 1;
    }

    return name.slice(0, end);
};

const escapeReserved = (name: string, isReserved: (name: string) => boolean): string =>
    isReserved(getUnsuffixedName(name)) ? `${name}${UNDERSCORE}` : name;

const unescapeReserved = (name: string, isReserved: (name: string) => boolean): string => {
    if (!name.endsWith(UNDERSCORE)) {
        return name;
    }

    const escaped = name.slice(0, -1);

    return isReserved(getUnsuffixedName(escaped)) ? escaped : name;
};

export { escapeReserved, unescapeReserved };
