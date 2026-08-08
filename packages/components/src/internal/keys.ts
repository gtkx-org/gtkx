const LENGTH_SEPARATOR = "\u{1}";

const encodePart = (value: string): string => `${String(value.length)}${LENGTH_SEPARATOR}${value}`;
const joinParts = (values: string[]): string => values.map((value) => encodePart(value)).join("");

const decodePartAt = (value: string, offset: number): string | null => {
    const separator = value.indexOf(LENGTH_SEPARATOR, offset);

    if (separator === -1) {
        return null;
    }

    const length = Number(value.slice(offset, separator));

    return value.slice(separator + 1, separator + 1 + length);
};

export { decodePartAt, encodePart, joinParts };
