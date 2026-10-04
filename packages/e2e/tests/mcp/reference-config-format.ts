import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect } from "vitest";
import type { referenceSession } from "./reference-session.js";
import { createProject } from "./app-session.js";

type ListApi = ReturnType<typeof referenceSession>["listApi"];

const expectProjectConfiguration = async (listApi: ListApi, configuration: string): Promise<void> => {
    const project = createProject();
    rmSync(join(project, "gtkx.config.mjs"));
    const path = join(project, configuration);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, 'module.exports = { applicationId: "org.gtkx.reference" };\n');

    try {
        expect(await listApi({ projectRoot: join(project, "src") })).toContain("Adw");
    } finally {
        rmSync(project, { recursive: true, force: true });
    }
};

export { expectProjectConfiguration };
