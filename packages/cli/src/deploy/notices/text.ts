import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXPLICIT_LICENSE_PREFIX = "SEE LICENSE IN ";
const LICENSE_FILE = /^(?:licen[cs]e|copying|notice)(?:[-._].*)?$/i;
const COPYRIGHT_LINE = /^(?:Copyright\b|©)/;
const MAX_COPYRIGHT_LINES = 20;
const MORE_COPYRIGHT = "and the other holders named in the license text";

const readLicenseText = (path: string): string | null => {
    try {
        return readFileSync(path, "utf8").trimEnd();
    } catch {
        return null;
    }
};

const licenseFilesIn = (dir: string, explicitFile: string | null): string[] =>
    readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && (LICENSE_FILE.test(entry.name) || entry.name === explicitFile))
        .map((entry) => entry.name)
        .toSorted((left, right) => left.localeCompare(right));

const licenseTextIn = (dir: string, license: string | null = null): string | null => {
    const explicitFile = license?.startsWith(EXPLICIT_LICENSE_PREFIX)
        ? license.slice(EXPLICIT_LICENSE_PREFIX.length)
        : null;
    const texts = licenseFilesIn(dir, explicitFile)
        .map((name) => readLicenseText(join(dir, name)))
        .filter((text) => text !== null);

    return texts.length === 0 ? null : texts.join("\n\n");
};

const copyrightLines = (text: string | null): string[] => {
    const found = (text ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => COPYRIGHT_LINE.test(line));

    const unique = [...new Set(found)];

    return unique.length > MAX_COPYRIGHT_LINES ? [...unique.slice(0, MAX_COPYRIGHT_LINES), MORE_COPYRIGHT] : unique;
};

export { copyrightLines, licenseTextIn, readLicenseText };
