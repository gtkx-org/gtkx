import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTempDir } from "./remove-temp-dir.js";

export const withStagingDir = <T>(prefix: string, produce: (dir: string) => T): T => {
    const dir = mkdtempSync(join(tmpdir(), `gtkx-${prefix}-`));
    try {
        return produce(dir);
    } finally {
        removeTempDir(dir);
    }
};
