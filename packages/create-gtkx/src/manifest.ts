import { closeSync, ftruncateSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_JSON_FILE = "package.json";

const updateManifest = (root: string, mutate: (manifest: Record<string, unknown>) => void): void => {
    const descriptor = openSync(join(root, PACKAGE_JSON_FILE), "r+");

    try {
        const manifest = JSON.parse(readFileSync(descriptor, "utf8")) as Record<string, unknown>;
        mutate(manifest);
        ftruncateSync(descriptor);
        writeSync(descriptor, `${JSON.stringify(manifest, null, 4)}\n`, 0);
    } finally {
        closeSync(descriptor);
    }
};

export { updateManifest };
