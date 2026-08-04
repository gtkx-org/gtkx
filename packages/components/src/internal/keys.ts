const LENGTH_SEPARATOR = "\u{1}";

const encodePart = (value: string): string => `${String(value.length)}${LENGTH_SEPARATOR}${value}`;
const joinParts = (values: string[]): string => values.map((value) => encodePart(value)).join("");

export { encodePart, joinParts };
