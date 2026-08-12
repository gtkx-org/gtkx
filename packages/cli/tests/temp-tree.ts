import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

type TempTree = { path: string; child: string };

const setupTempTree = (prefix: string, ...childSegments: string[]): TempTree => {
    const tree: TempTree = { path: "", child: "" };

    beforeEach(() => {
        tree.path = mkdtempSync(join(tmpdir(), prefix));
        tree.child = join(tree.path, ...childSegments);
        mkdirSync(tree.child, { recursive: true });
    });

    afterEach(() => {
        rmSync(tree.path, { recursive: true, force: true });
    });

    return tree;
};

export { setupTempTree, type TempTree };
