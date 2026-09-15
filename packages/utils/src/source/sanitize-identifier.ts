import { isKeyword, isStrictBindReservedWord } from "@babel/helper-validator-identifier";
import { escapeIdentifierStart } from "./escape-identifier-start.ts";
import { escapeReserved } from "./escape-reserved.ts";

const isReservedIdentifier = (name: string): boolean => isKeyword(name) || isStrictBindReservedWord(name, true);

function sanitizeIdentifier(name: string): string {
    return escapeIdentifierStart(escapeReserved(name, isReservedIdentifier));
}

export { isReservedIdentifier, sanitizeIdentifier };
