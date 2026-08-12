type PathPart = {
    part: string;
    offset: number;
};

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

function scanParts(path: string): PathPart[] {
    const parts: PathPart[] = [];
    let offset = 0;

    while (offset < path.length) {
        const part = decodePartAt(path, offset);

        if (part === null) {
            return parts;
        }

        parts.push({ part, offset });
        offset += encodePart(part).length;
    }

    return parts;
}

export { decodePartAt, encodePart, joinParts, scanParts };
