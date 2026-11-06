/**
 * The indentation of the first indented property in a JSON document's text, or `fallback` when no
 * property is indented, so a rewritten document keeps the layout its author or formatter chose.
 */
const indentOf = (text: string, fallback: string): string =>
    /^(?<indent>[ \t]+)"/m.exec(text)?.groups?.indent ?? fallback;

export { indentOf };
