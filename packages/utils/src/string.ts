export const toUpperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const toLowerFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const splitWords = (input: string): string[] => input.split(/[_-]/g).filter((part) => part.length > 0);

export const toCamelCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    const [first, ...rest] = parts;
    const head = first ?? "";
    return head + rest.map(toUpperFirst).join("");
};

export const toPascalCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map(toUpperFirst).join("");
};

export const toKebabCase = (input: string): string =>
    input.replaceAll(/[A-Z]/g, (char, index: number) => (index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`));
