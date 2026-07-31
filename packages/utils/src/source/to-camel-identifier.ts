import { camelCase } from "../string/camel-case.ts";
import { sanitizeIdentifier } from "./sanitize-identifier.ts";

function toCamelIdentifier(name: string): string {
    return sanitizeIdentifier(camelCase(name));
}

export { toCamelIdentifier };
