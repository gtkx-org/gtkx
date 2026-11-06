import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { readLicenseText } from "../notices/text.js";

const LICENSE_FILENAME = "LICENSE";
const NODE_MARKER = "Node.js";

const binaryPaths = (binary: string): string[] => (existsSync(binary) ? [binary, realpathSync(binary)] : [binary]);

const licenseCandidates = (binary: string): string[] =>
    binaryPaths(binary).flatMap((path) => {
        const dir = dirname(path);

        return [join(dir, LICENSE_FILENAME), join(dir, "..", LICENSE_FILENAME)];
    });

const isNodeLicense = (path: string): boolean => readLicenseText(path)?.includes(NODE_MARKER) === true;

const licenseBesideNode = (binary: string): string | null =>
    licenseCandidates(binary).find((candidate) => isNodeLicense(candidate)) ?? null;

export { LICENSE_FILENAME, licenseBesideNode };
