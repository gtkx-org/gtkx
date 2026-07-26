/**
 * Converts a camelCase or PascalCase string to kebab case by lower-casing uppercase letters and
 * inserting hyphens before interior ones.
 *
 * @param str - The string to convert.
 * @returns The kebab-cased string.
 *
 * @example
 * kebabCase("iconName"); // "icon-name"
 * kebabCase("Title"); // "title"
 */
function kebabCase(str: string): string {
    return str.replaceAll(/[A-Z]/g, (char, index: number) =>
        index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`,
    );
}

export { kebabCase };
