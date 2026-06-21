/**
 * Temporary staging-directory lifecycle shared by the asset-compiling Vite
 * plugins.
 *
 * A staging directory is created under the OS temp dir with a `gtkx-<prefix>-`
 * name, populated, consumed to produce a result, and removed afterward. The
 * removal runs whether or not the producer throws.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTempDir } from "./remove-temp-dir.js";

/**
 * Creates a `gtkx-<prefix>-` staging directory, runs {@link produce} against it,
 * and removes the directory afterward, including when {@link produce} throws.
 *
 * @param prefix - The middle segment of the staging directory name.
 * @param produce - Receives the staging directory path and returns the result.
 */
export const withStagingDir = <T>(prefix: string, produce: (dir: string) => T): T => {
    const dir = mkdtempSync(join(tmpdir(), `gtkx-${prefix}-`));
    try {
        return produce(dir);
    } finally {
        removeTempDir(dir);
    }
};
