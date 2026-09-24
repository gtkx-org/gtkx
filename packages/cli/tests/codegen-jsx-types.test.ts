import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const CONFIG = 'export default { applicationId: "org.gtkx.jsxcontracts" };\n';
const ACCEPTED = `import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
import type { GtkLabelProps } from "./node_modules/.gtkx/jsx/gtk/gtk.js";

declare module "./node_modules/.gtkx/jsx/gtk/gtk.js" {
    interface GtkLabelProps { consumer?: string }
}

export const selections: AdwToggleGroupProps[] = [{}, { active: 0 }, { activeName: "first" }];
export const notify: AdwToggleGroupProps = {
    active: 0,
    onNotifyActive: (value) => value,
    onNotifyActiveName: (value) => value,
};
export const augmented: GtkLabelProps = { consumer: "value", label: "Label" };
`;
const REJECTED = `import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
export const selection: AdwToggleGroupProps = { active: 0, activeName: "first" };
`;

const typecheck = (project: CliProject, file: string): number | null => spawnSync(
    process.execPath,
    [
        TYPESCRIPT_CLI,
        "--noEmit",
        "--module", "ESNext",
        "--moduleResolution", "Bundler",
        "--target", "ESNext",
        "--strict",
        "--skipLibCheck", "true",
        "--types", "node",
        file,
    ],
    { cwd: project.root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
).status;

describe("gtkx codegen JSX prop contracts", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-jsx-types-",
            config: CONFIG,
            files: { "accepted.ts": ACCEPTED, "rejected.ts": REJECTED },
        });
        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("accepts each selection form and preserves interface augmentation", () => {
        expect(state.status).toBe(0);
        expect(typecheck(state.project, "accepted.ts")).toBe(0);
    });

    it("rejects naming and indexing the same controlled selection together", () => {
        expect(state.status).toBe(0);
        expect(typecheck(state.project, "rejected.ts")).not.toBe(0);
    });
});
