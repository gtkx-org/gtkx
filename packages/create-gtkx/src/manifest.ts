import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_JSON_FILE = "package.json";

const updateManifest = (root: string, mutate: (manifest: Record<string, unknown>) => void): void => {
    const manifestPath = join(root, PACKAGE_JSON_FILE);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    mutate(manifest);
    const pendingPath = join(root, `.package-${randomUUID()}.json`);

    try {
        writeFileSync(pendingPath, `${JSON.stringify(manifest, null, 4)}\n`, { flag: "wx", mode: 0o600 });
        renameSync(pendingPath, manifestPath);
    } finally {
        rmSync(pendingPath, { force: true });
    }
};

export { updateManifest };
