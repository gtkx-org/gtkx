import { upperFirst } from "./upper-first.ts";
import { mapWordSegments } from "./word-segments.ts";

function camelCase(str: string): string {
    return mapWordSegments(str, (part, index) => (index === 0 ? part : upperFirst(part)));
}

export { camelCase };
