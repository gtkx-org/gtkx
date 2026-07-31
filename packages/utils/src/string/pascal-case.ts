import { upperFirst } from "./upper-first.ts";
import { mapWordSegments } from "./word-segments.ts";

function pascalCase(str: string): string {
    return mapWordSegments(str, upperFirst);
}

export { pascalCase };
