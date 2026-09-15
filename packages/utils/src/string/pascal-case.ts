import { upperFirst } from "es-toolkit";
import { mapWordSegments } from "./word-segments.ts";

function pascalCase(str: string): string {
    return mapWordSegments(str, upperFirst);
}

export { pascalCase };
