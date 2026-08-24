import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "../src/builder.js";
import { runNode } from "./app-project.js";
import { type CliProject, createCliProject, removeCliProject } from "./cli-project.js";

const OUT_DIR = "dist";
const APPLICATION_ID = "com.gtkx.compilerfilter";
const DEPENDENCY = "compiler-filter-dependency";

const PROJECT_SOURCE = `export const Value = ({ value }: { value: number }) => value;

process.stdout.write("42");
`;

const INVALID_COMPONENT = `import { useState } from "react";

export function Invalid({ enabled }: { enabled: boolean }) {
    if (enabled) {
        useState(0);
    }

    return null;
}
`;

const DEPENDENCY_SOURCE = `${INVALID_COMPONENT}
export const value = 42;
`;

const DEPENDENCY_ENTRY = `import { value } from "${DEPENDENCY}";

process.stdout.write(String(value));
`;

const config = `export default {
    applicationId: "${APPLICATION_ID}",
    codegen: false,
    libraries: ["Gtk-4.0"],
    reactCompiler: {
        compilationMode: "all",
        panicThreshold: "all_errors",
    },
};
`;

const projectFiles = (source: string, hasDependency = false): Record<string, string> => ({
    [join("src", "index.tsx")]: source,
    ...(hasDependency && {
        [join("node_modules", DEPENDENCY, "package.json")]: `${JSON.stringify(
            { name: DEPENDENCY, type: "module", exports: "./index.tsx" },
            null,
            4,
        )}\n`,
        [join("node_modules", DEPENDENCY, "index.tsx")]: DEPENDENCY_SOURCE,
    }),
});

const buildProject = async (project: CliProject): Promise<string> => {
    const output = await build({
        entry: join(project.root, "src", "index.tsx"),
        vite: {
            root: project.root,
            logLevel: "warn",
            build: { outDir: OUT_DIR, emptyOutDir: true },
        },
    });

    return join(project.root, output);
};

describe("React Compiler project filtering", () => {
    let project: CliProject | undefined;

    afterEach(() => {
        if (project === undefined) {
            return;
        }

        removeCliProject(project);
        project = undefined;
    });

    it("compiles and runs project TSX", async () => {
        project = createCliProject({ prefix: "gtkx-compiler-source-", config, files: projectFiles(PROJECT_SOURCE) });
        const run = runNode(await buildProject(project));
        expect(run.status).toBe(0);
        expect(run.stderr).toBe("");
        expect(run.stdout).toBe("42");
    });

    it("leaves TSX dependencies outside the project uncompiled", async () => {
        project = createCliProject({
            prefix: "gtkx-compiler-dependency-",
            config,
            files: projectFiles(DEPENDENCY_ENTRY, true),
        });

        const run = runNode(await buildProject(project));
        expect(run.status).toBe(0);
        expect(run.stderr).toBe("");
        expect(run.stdout).toBe("42");
    });

    it("rejects compiler errors in project TSX", async () => {
        project = createCliProject({
            prefix: "gtkx-compiler-error-",
            config,
            files: projectFiles(INVALID_COMPONENT),
        });

        await expect(buildProject(project)).rejects.toThrow();
    });
});
