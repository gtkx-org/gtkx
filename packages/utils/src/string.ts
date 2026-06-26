export const upperFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const lowerFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const splitWords = (input: string): string[] => input.split(/[_-]/g).filter((part) => part.length > 0);

export const toCamelCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map((part, index) => (index === 0 ? part : upperFirst(part))).join("");
};

export const toPascalCase = (input: string): string => {
    const parts = splitWords(input);
    if (parts.length === 0) return input;
    return parts.map(upperFirst).join("");
};

export const toKebabCase = (input: string): string =>
    input.replaceAll(/[A-Z]/g, (char, index: number) => (index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`));
