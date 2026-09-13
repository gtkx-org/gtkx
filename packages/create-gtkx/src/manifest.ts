import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_JSON_FILE = "package.json";

const updateManifest = (root: string, mutate: (manifest: Record<string, unknown>) => void): void => {
    const manifestPath = join(root, PACKAGE_JSON_FILE);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    mutate(manifest);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
};

export { updateManifest };
