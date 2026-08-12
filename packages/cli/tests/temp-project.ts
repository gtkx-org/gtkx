import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

type TempProject = { path: string };

const setupTempProject = (prefix: string): TempProject => {
    const project: TempProject = { path: "" };

    beforeEach(() => {
        project.path = mkdtempSync(join(tmpdir(), prefix));
        mkdirSync(join(project.path, "src"));
    });

    afterEach(() => {
        rmSync(project.path, { recursive: true, force: true });
    });

    return project;
};

export { setupTempProject };
