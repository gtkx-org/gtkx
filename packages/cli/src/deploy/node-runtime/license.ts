import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const LICENSE_FILENAME = "LICENSE";
const NODE_MARKER = "Node.js";

const licenseCandidates = (binary: string): string[] => {
    const dir = dirname(binary);

    return [join(dir, LICENSE_FILENAME), join(dir, "..", LICENSE_FILENAME)];
};

const isNodeLicense = (path: string): boolean => {
    try {
        return readFileSync(path, "utf8").includes(NODE_MARKER);
    } catch {
        return false;
    }
};

const licenseBesideNode = (binary: string): string | null =>
    licenseCandidates(binary).find((candidate) => isNodeLicense(candidate)) ?? null;

export { LICENSE_FILENAME, licenseBesideNode };
