import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const removeTempDir = (dir: string): void => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
};

export const withStagingDir = <T>(prefix: string, produce: (dir: string) => T): T => {
    const dir = mkdtempSync(join(tmpdir(), `gtkx-${prefix}-`));
    try {
        return produce(dir);
    } finally {
        removeTempDir(dir);
    }
};
