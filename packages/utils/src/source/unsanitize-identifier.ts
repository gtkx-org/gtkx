import { unescapeIdentifierStart } from "./escape-identifier-start.ts";
import { unescapeReserved } from "./escape-reserved.ts";
import { RESERVED } from "./sanitize-identifier.ts";

function unsanitizeIdentifier(name: string): string {
    return unescapeReserved(unescapeIdentifierStart(name), RESERVED);
}

export { unsanitizeIdentifier };
