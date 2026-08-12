import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

type WorkspaceRef = { root: string; app: string };

const setupWorkspace = (prefix: string): WorkspaceRef => {
    const ref: WorkspaceRef = { root: "", app: "" };

    beforeEach(() => {
        ref.root = mkdtempSync(join(tmpdir(), prefix));
        ref.app = join(ref.root, "packages", "app");
        mkdirSync(ref.app, { recursive: true });
    });

    afterEach(() => {
        rmSync(ref.root, { recursive: true, force: true });
    });

    return ref;
};

export { setupWorkspace };
