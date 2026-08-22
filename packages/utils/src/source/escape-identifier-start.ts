const DIGIT_START = /^\d/;
const ESCAPED_DIGIT_START = /^_\d/;

const escapeIdentifierStart = (name: string): string => (DIGIT_START.test(name) ? `_${name}` : name);

const unescapeIdentifierStart = (name: string): string =>
    ESCAPED_DIGIT_START.test(name) ? name.slice(1) : name;

export { escapeIdentifierStart, unescapeIdentifierStart };
