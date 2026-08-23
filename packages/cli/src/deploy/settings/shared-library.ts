import { closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";

const GIR_SUFFIX = ".gir";
const HEADER_BYTES = 65_536;
const NAMESPACE_ELEMENT = /<namespace\b[^>]*>/;
const SHARED_LIBRARY_ATTRIBUTE = /\bshared-library="([^"]*)"/;
const SONAME_SEPARATOR = ",";

const readHeaderFrom = (handle: number): string => {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const read = readSync(handle, buffer, 0, HEADER_BYTES, 0);

    return buffer.toString("utf8", 0, read);
};

const readHeader = (path: string): string | null => {
    let handle: number | null = null;

    try {
        handle = openSync(path, "r");

        return readHeaderFrom(handle);
    } catch {
        return null;
    } finally {
        if (handle !== null) {
            closeSync(handle);
        }
    }
};

const sharedLibraryAttribute = (header: string): string | null => {
    const element = NAMESPACE_ELEMENT.exec(header)?.[0];

    if (element === undefined) {
        return null;
    }

    return SHARED_LIBRARY_ATTRIBUTE.exec(element)?.[1] ?? "";
};

const splitSonames = (attribute: string): string[] =>
    attribute
        .split(SONAME_SEPARATOR)
        .map((soname) => soname.trim())
        .filter((soname) => soname.length > 0);

const readSharedLibraries = (library: string, girPath: string[]): string[] | null => {
    for (const dir of girPath) {
        const header = readHeader(join(dir, `${library}${GIR_SUFFIX}`));
        const attribute = header === null ? null : sharedLibraryAttribute(header);

        if (attribute !== null) {
            return splitSonames(attribute);
        }
    }

    return null;
};

export { readSharedLibraries };
