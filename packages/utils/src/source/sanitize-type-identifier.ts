import { escapeIdentifierStart } from "./escape-identifier-start.ts";
import { escapeReserved } from "./escape-reserved.ts";
import { RESERVED } from "./sanitize-identifier.ts";

const TYPE_RESERVED: Set<string> = new Set([
    ...RESERVED,
    "any",
    "bigint",
    "boolean",
    "never",
    "number",
    "object",
    "string",
    "symbol",
    "undefined",
    "unknown",
]);

function sanitizeTypeIdentifier(name: string): string {
    return escapeIdentifierStart(escapeReserved(name, TYPE_RESERVED));
}

export { sanitizeTypeIdentifier };
