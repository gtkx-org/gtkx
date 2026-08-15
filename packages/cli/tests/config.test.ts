import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

type RejectedConfig = { title: string; config: string };

const APPLICATION_ID = "com.gtkx.cliconfig";
const PRODUCTION_ID = `${APPLICATION_ID}.production`;
const BUNDLE = join("dist", "bundle.mjs");

const APP_SOURCE = `import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";

createRoot().render(
    <GtkApplication>
        <GtkApplicationWindow title="Probe" />
    </GtkApplication>,
);
`;

const FUNCTION_CONFIG = `import { defineConfig } from "@gtkx/config";

export default defineConfig(() => ({
    applicationId: "${APPLICATION_ID}",
    libraries: ${JSON.stringify(STORE_LIBRARIES)},
    codegen: false,
    $production: { applicationId: "${PRODUCTION_ID}" },
}));
`;

const HEAD = `export default { applicationId: "${APPLICATION_ID}"`;

const REJECTED_CONFIGS: RejectedConfig[] = [
    { title: "an application id that is not a valid identifier", config: "export default { applicationId: 1 };\n" },
    { title: "user event signals that are not a table", config: `${HEAD}, userEventSignals: 5 };\n` },
    { title: "an elements section that is not an object", config: `${HEAD}, elements: "all" };\n` },
    { title: "a deploy section that is not shaped like one", config: `${HEAD}, deploy: { categories: 5 } };\n` },
    { title: "a future flag that is not a boolean", config: `${HEAD}, future: { v2ByteArrays: 5 } };\n` },
];

const buildWith = (config: string): CliProject => {
    const project = createCliProject({
        prefix: "gtkx-cli-config-",
        config,
        files: { [join("src", "index.tsx")]: APP_SOURCE },
        hasStore: true,
    });

    expect(runCli(project, ["build"]).status).toBe(0);

    return project;
};

describe("gtkx.config.ts", () => {
    it("reads a configuration authored as a function, with the branch for the mode it builds in", () => {
        const project = buildWith(FUNCTION_CONFIG);

        try {
            expect(readFileSync(join(project.root, BUNDLE), "utf8")).toContain(PRODUCTION_ID);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx.config.ts (configurations the commands reject)", () => {
    it.each(REJECTED_CONFIGS)("fails over $title", ({ config }) => {
        const project = createCliProject({ prefix: "gtkx-cli-config-broken-", config, hasStore: true });

        try {
            expect(runCli(project, ["codegen"]).status).not.toBe(0);
        } finally {
            removeCliProject(project);
        }
    });
});
