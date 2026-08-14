const DIGIT_START = /^\d/;

const escapeIdentifierStart = (name: string): string => (DIGIT_START.test(name) ? `_${name}` : name);

export { escapeIdentifierStart };
