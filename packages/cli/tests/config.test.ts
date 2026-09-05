import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

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
    { title: "an icon path that is not text", config: `${HEAD}, applicationIcon: 5 };\n` },
    { title: "a wildcard library selection", config: `${HEAD}, libraries: "*" };\n` },
    { title: "a disabled graduated future", config: `${HEAD}, future: { v2ByteArrays: false } };\n` },
    { title: "an unknown future", config: `${HEAD}, future: { v2ByteArrrays: true } };\n` },
    {
        title: "a retired deprecation id",
        config: `${HEAD}, deprecations: { silence: ["gtkx-v2-byte-arrays"] } };\n`,
    },
    { title: "the implicit Adwaita version", config: `${HEAD}, libraries: ["Adw-1"] };\n` },
    { title: "the transitive GTK version", config: `${HEAD}, libraries: ["Gtk-4.0"] };\n` },
    { title: "an icon path under deploy", config: `${HEAD}, deploy: { icons: "data/icons" } };\n` },
    {
        title: "a minimum library version that is not a version",
        config: `${HEAD}, deploy: { minimumLibraryVersions: { "Gtk-4.0": 4.18 } } };\n`,
    },
    {
        title: "a minimum library version keyed by something that is not a library",
        config: `${HEAD}, deploy: { minimumLibraryVersions: { "Gtk-4.o": "4.18" } } };\n`,
    },
];

const buildWith = (config: string): ReturnType<typeof createCliProject> => {
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
        using project = buildWith(FUNCTION_CONFIG);

        expect(readFileSync(join(project.root, BUNDLE), "utf8")).toContain(PRODUCTION_ID);
    });

    it("accepts graduated future flags left enabled", () => {
        const config = `${HEAD}, codegen: false, future: {
            v2ByteArrays: true,
            v2ValueReturns: true,
            v2FinishResults: true,
            v2InoutReturns: true,
            v2ResourceImports: true,
            v2DefaultLibraries: true,
            v2TreeShaking: true,
        } };\n`;

        using project = createCliProject({ prefix: "gtkx-cli-config-graduated-", config, hasStore: true });

        expect(runCli(project, ["codegen"]).status).toBe(0);
    });
});

describe("gtkx.config.ts (configurations the commands reject)", () => {
    it.each(REJECTED_CONFIGS)("fails over $title", ({ config }) => {
        using project = createCliProject({ prefix: "gtkx-cli-config-broken-", config, hasStore: true });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
    });
});
