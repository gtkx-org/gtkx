import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    listProjectFiles,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";

type AppRun = { status: number | null; stdout: string; stderr: string };
type BrokenEntry = { title: string; args: string[] };

const APPLICATION_ID = "com.gtkx.clibuild";
const READY_MARKER = "app-ready";
const RUN_TIMEOUT = 60_000;
const OUT_DIR = "dist";
const BUNDLE = "bundle.mjs";
const SCHEMA_FILE = `${APPLICATION_ID}.gschema.xml`;
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);
const EMITTED = ["bundle.mjs", "gtkx.node", "gtkx.gresource", "gschemas.compiled", ICON_PATH];
const SCHEMA_TYPES = join("node_modules", ".gtkx", "env.d.ts");

const BROKEN_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}">
`;

const MANIFEST = {
    name: "gtkx-cli-build",
    version: "1.0.0",
    type: "module",
    imports: { "#data/*": "./data/*" },
};

const SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}" path="/com/gtkx/clibuild/">
        <key name="counter" type="i">
            <default>7</default>
        </key>
    </schema>
</schemalist>
`;

const APP_SOURCE = String.raw`import { css } from "@gtkx/css";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit, useSetting } from "@gtkx/react";
import { useEffect } from "react";
import schema from "#data/${SCHEMA_FILE}";
import logo from "#data/logo.png";

const heading = css({ fontWeight: "bold" });

const App = () => {
    const [counter] = useSetting(schema, "counter");

    useEffect(() => {
        process.stdout.write("${READY_MARKER} " + String(counter) + " " + logo + "\n");
        quit();
    }, [counter]);

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Probe">
                <GtkLabel label="probe" cssClasses={[heading]} />
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

createRoot().render(<App />);
`;

const ABSENT_SOURCE = `import * as absent from "@gtkx/gi/nosuchlibrary";
import { createRoot } from "@gtkx/react";

createRoot();
process.stdout.write(String(Object.keys(absent).length));
`;

const BROKEN_ENTRIES: BrokenEntry[] = [
    { title: "an entry the project does not have", args: ["src/missing.tsx"] },
    { title: "a project with no entry at all", args: [] },
];

const config = (libraries: string[], body = ""): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(libraries)}${body} };\n`;

const appFiles = (entry: string): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    [join("data", SCHEMA_FILE)]: SCHEMA,
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("data", "logo.png")]: "png-probe\n",
    [join("src", entry)]: APP_SOURCE,
});

const emittedNames = (project: CliProject): string[] => listProjectFiles(project, OUT_DIR);

const runApp = (project: CliProject): AppRun => {
    const bundle = join(project.root, OUT_DIR, BUNDLE);

    const result = spawnSync(process.execPath, [bundle], {
        cwd: join(project.root, OUT_DIR),
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

describe("gtkx build", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-build-",
            config: config(STORE_LIBRARIES),
            files: appFiles("index.tsx"),
            hasStore: true,
        });

        state.status = runCli(state.project, ["build"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("emits the bundle beside the addon, the icons, the schemas and the resources", () => {
        const emitted = emittedNames(state.project);
        expect(state.status).toBe(0);
        expect(EMITTED.filter((name) => !emitted.includes(name))).toEqual([]);
    });

    it("declares the schemas the project's sources can read", () => {
        expect(existsSync(join(state.project.root, SCHEMA_TYPES))).toBe(true);
    });

    it("emits a bundle that starts, reads its settings and reaches its resources", () => {
        const run = runApp(state.project);
        expect(run.stderr).toBe("");
        expect(run.stdout).toContain(`${READY_MARKER} 7 `);
        expect(run.status).toBe(0);
    });
});

describe("gtkx build (an entry the command is given)", () => {
    it("builds the named entry into the requested asset base", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-entry-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: appFiles("main.tsx"),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build", "src/main.tsx", "--asset-base", "../share/probe"]).status).toBe(0);
            expect(emittedNames(project)).toContain(BUNDLE);
            expect(runApp(project).stdout).toContain(READY_MARKER);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx build (projects it refuses to build)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-build-broken-",
            config: config(["Gtk-4.0"], ", codegen: false"),
            files: { [join("src", "absent.tsx")]: ABSENT_SOURCE },
            hasStore: true,
        });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(BROKEN_ENTRIES)("fails over $title", ({ args }) => {
        expect(runCli(state.project, ["build", ...args]).status).not.toBe(0);
    });

    it("fails over an entry that imports bindings the project has no library for", () => {
        expect(runCli(state.project, ["build", "src/absent.tsx"]).status).not.toBe(0);
    });

    it("fails over a settings schema it cannot parse", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-schema-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: { ...appFiles("index.tsx"), [join("data", SCHEMA_FILE)]: BROKEN_SCHEMA },
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).not.toBe(0);
        } finally {
            removeCliProject(project);
        }
    });
});
