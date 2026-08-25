import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    listProjectFiles,
    removeCliProject,
    runCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";

type AppRun = { status: number | null; stdout: string; stderr: string };
type BrokenEntry = { title: string; args: string[] };
type BrokenBuild = { config?: string | undefined; files: Record<string, string>; prefix: string };

const APPLICATION_ID = "com.gtkx.clibuild";
const READY_MARKER = "app-ready";
const RUN_TIMEOUT = 60_000;
const OUT_DIR = "dist";
const BUNDLE = "bundle.mjs";
const SCHEMA_FILE = `${APPLICATION_ID}.gschema.xml`;
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);

const EMITTED = [
    "bundle.mjs",
    "gtkx.node",
    "gtkx.gresource",
    "gschemas.compiled",
    "gtkx-schemas.json",
    ICON_PATH,
];

const SCHEMA_TYPES = join("node_modules", ".gtkx", "env.d.ts");
const FOLDERS_ID = `${APPLICATION_ID}.app-folders`;
const FOLDER_CHILD = "probe-folder";
const EXPLICIT_RESOURCE_PATH = "/com/gtkx/clibuild/explicit-logo.png";
const DERIVED_RESOURCE_PATH = "/com/gtkx/clibuild/data/logo.png";
const PACKAGE_NAME = "@probe/resource-package";
const PACKAGE_RESOURCE_PATH = `/com/gtkx/clibuild/${PACKAGE_NAME}/icons/star.svg`;
const LEGACY_RESOURCE_PATH = "/com/gtkx/clibuild/logo.png";
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));

const BROKEN_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}">
`;

const MANIFEST = {
    name: "gtkx-cli-build",
    version: "1.0.0",
    type: "module",
};

const LEGACY_MANIFEST = {
    ...MANIFEST,
    imports: { "#data/*": "./data/*" },
};

const SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}" path="/com/gtkx/clibuild/">
        <key name="counter" type="i">
            <default>7</default>
        </key>
    </schema>
    <schema id="${FOLDERS_ID}" path="/com/gtkx/clibuild/app-folders/">
        <key name="folder-children" type="as">
            <default>['${FOLDER_CHILD}']</default>
        </key>
    </schema>
</schemalist>
`;

const COLLIDING_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}.app-folders" path="/com/gtkx/clibuild/dashed/">
        <key name="counter" type="i">
            <default>1</default>
        </key>
    </schema>
    <schema id="${APPLICATION_ID}.appFolders" path="/com/gtkx/clibuild/camel/">
        <key name="counter" type="i">
            <default>2</default>
        </key>
    </schema>
</schemalist>
`;

const APP_SOURCE = String.raw`import { css } from "@gtkx/css";
import * as Gio from "@gtkx/gi/gio";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit, useSetting } from "@gtkx/react";
import packageResourcePath from "${PACKAGE_NAME}";
import { readFileSync } from "node:fs";
import { useEffect } from "react";
import schema, { com_gtkx_clibuild_appFolders as folders } from "../data/${SCHEMA_FILE}";
import logoPath, { path as namedLogoPath } from "../data/logo.png?resource";
import logoFile from "../data/logo.png?url";
import explicitLogoPath from "../data/explicit.png?resource=${EXPLICIT_RESOURCE_PATH}";

const heading = css({ fontWeight: "bold" });

const App = () => {
    const [counter] = useSetting(schema, "counter");
    const [children] = useSetting(folders, "folder-children");

    useEffect(() => {
        const emittedLogo = readFileSync(logoFile, "utf8").trim();
        const bundledLogo = Buffer.from(
            Gio.resourcesLookupData(logoPath, Gio.ResourceLookupFlags.NONE).getData() ?? [],
        ).toString("utf8").trim();
        const packageResource = Buffer.from(
            Gio.resourcesLookupData(packageResourcePath, Gio.ResourceLookupFlags.NONE).getData() ?? [],
        ).toString("utf8").trim();
        process.stdout.write(
            "${READY_MARKER} " + String(counter) + " " + children.join(",") + " " + logoPath + " " +
            namedLogoPath + " " + explicitLogoPath + " " + emittedLogo + " " + bundledLogo + " " +
            packageResourcePath + " " + packageResource + "\n",
        );
        quit();
    }, [counter, children]);

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

const BARE_ASSET_SOURCE = `import logo from "../data/logo.png";

const path: string = logo;
export { path };
`;

const LEGACY_APP_SOURCE = `import * as Gio from "@gtkx/gi/gio";
import schema from "#data/${SCHEMA_FILE}";
import logoUri, { path as logoPath } from "#data/logo.png";

const logo = Buffer.from(
    Gio.resourcesLookupData(logoPath, Gio.ResourceLookupFlags.NONE).getData() ?? [],
).toString("utf8").trim();

process.stdout.write([schema.id, logoUri, logoPath, logo].join(" "));
`;

const EXPLICIT_TYPE_SOURCE = `import logo from "../data/logo.png?resource=/com/gtkx/type-probe.png";

const path: string = logo;
export { path };
`;

const RESOURCE_COLLISION_SOURCE = `import first from "../data/logo.png?resource=/com/gtkx/collision.png";
import second from "../data/explicit.png?resource=/com/gtkx/collision.png";

process.stdout.write(first + second);
`;

const URL_NAMED_EXPORT_SOURCE = `import { path } from "../data/logo.png?url";

process.stdout.write(path);
`;

const DUPLICATE_SCHEMA_SOURCE = `import first from "../data/one/${SCHEMA_FILE}";
import second from "../data/two/${SCHEMA_FILE}";

process.stdout.write(first.id + second.id);
`;

const BROKEN_ENTRIES: BrokenEntry[] = [
    { title: "an entry the project does not have", args: ["src/missing.tsx"] },
    { title: "a project with no entry at all", args: [] },
];

const config = (libraries: string[], body = "", icons = "data/icons"): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(libraries)}, ` +
    `icons: ${JSON.stringify(icons)}, future: ${JSON.stringify(STORE_FUTURE)}${body} };\n`;

const legacyConfig = (): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)}, ` +
    `future: ${JSON.stringify({ ...STORE_FUTURE, v2ResourceImports: false })} };\n`;

const appFiles = (entry: string): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    [join("data", SCHEMA_FILE)]: SCHEMA,
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("data", "logo.png")]: "png-probe\n",
    [join("data", "explicit.png")]: "explicit-png-probe\n",
    [join("src", entry)]: APP_SOURCE,
});

const legacyFiles = (): Record<string, string> => ({
    "package.json": `${JSON.stringify(LEGACY_MANIFEST, null, 4)}\n`,
    [join("data", SCHEMA_FILE)]: SCHEMA,
    [join("data", "logo.png")]: "legacy-png-probe\n",
    [join("src", "index.ts")]: LEGACY_APP_SOURCE,
});

const typecheckFiles = (): Record<string, string> => {
    const compilerOptions = {
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
    };

    const tsconfig = (source: string): string =>
        `${JSON.stringify({ compilerOptions, files: [SCHEMA_TYPES, source] }, null, 4)}\n`;

    return {
        [join("data", "logo.png")]: "type-probe\n",
        [join("src", "bare.ts")]: BARE_ASSET_SOURCE,
        [join("src", "explicit.ts")]: EXPLICIT_TYPE_SOURCE,
        "tsconfig.bare.json": tsconfig("src/bare.ts"),
        "tsconfig.explicit.json": tsconfig("src/explicit.ts"),
    };
};

const emittedNames = (project: CliProject): string[] => listProjectFiles(project, OUT_DIR);

const installResourcePackage = (project: CliProject): void => {
    const packageDir = join(project.nodeModules, PACKAGE_NAME);
    const iconDir = join(packageDir, "icons");
    mkdirSync(iconDir, { recursive: true });

    writeFileSync(
        join(packageDir, "package.json"),
        `${JSON.stringify({ name: PACKAGE_NAME, type: "module", exports: "./index.js" }, null, 4)}\n`,
    );

    writeFileSync(
        join(packageDir, "index.js"),
        'import path from "./icons/star.svg?resource";\nexport default path;\n',
    );

    writeFileSync(join(iconDir, "star.svg"), "package-svg-probe\n");
};

const expectBuildFailure = (broken: BrokenBuild): void => {
    const project = createCliProject({
        prefix: broken.prefix,
        config: broken.config ?? config(STORE_LIBRARIES, ", codegen: false"),
        files: broken.files,
        hasStore: true,
    });

    installResourcePackage(project);

    try {
        expect(runCli(project, ["build"]).status).not.toBe(0);
    } finally {
        removeCliProject(project);
    }
};

const expectOutsideSchemaBuildFailure = (): void => {
    const project = createCliProject({
        prefix: "gtkx-cli-build-outside-schema-",
        config: config(STORE_LIBRARIES, ", codegen: false"),
        files: appFiles("index.ts"),
        hasStore: true,
    });

    const outsideSchema = `${project.root}.gschema.xml`;
    const entry = join(project.root, "src", "index.ts");
    const specifier = relative(dirname(entry), outsideSchema).replaceAll("\\", "/");
    writeFileSync(outsideSchema, SCHEMA);
    writeFileSync(entry, `import schema from ${JSON.stringify(specifier)};\nprocess.stdout.write(schema.id);\n`);

    try {
        expect(runCli(project, ["build"]).status).not.toBe(0);
    } finally {
        rmSync(outsideSchema, { force: true });
        removeCliProject(project);
    }
};

const runApp = (project: CliProject): AppRun => {
    const bundle = join(project.root, OUT_DIR, BUNDLE);

    const result = spawnSync(process.execPath, [bundle], {
        cwd: join(project.root, OUT_DIR),
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

const runTypecheck = (project: CliProject, configFile: string): number | null =>
    spawnSync(process.execPath, [TYPESCRIPT_CLI, "--project", configFile], {
        cwd: project.root,
        encoding: "utf8",
        timeout: RUN_TIMEOUT,
    }).status;

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

        installResourcePackage(state.project);
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
        const declarations = readFileSync(join(state.project.root, SCHEMA_TYPES), "utf8");
        expect(declarations).toContain(`declare module "*/${SCHEMA_FILE}"`);
        expect(declarations).toContain(`declare module "*?resource=${EXPLICIT_RESOURCE_PATH}"`);
    });

    it("emits a bundle that starts, reads its settings and reaches its resources", () => {
        const run = runApp(state.project);
        expect(run.stderr).toBe("");
        expect(run.stdout).toContain(`${READY_MARKER} 7 ${FOLDER_CHILD} `);

        expect(run.stdout).toContain(
            `${DERIVED_RESOURCE_PATH} ${DERIVED_RESOURCE_PATH} ${EXPLICIT_RESOURCE_PATH} png-probe png-probe`,
        );

        expect(run.stdout).toContain(`${PACKAGE_RESOURCE_PATH} package-svg-probe`);
        expect(run.status).toBe(0);
    });
});

describe("gtkx build (legacy resource imports)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-build-legacy-",
            config: legacyConfig(),
            files: legacyFiles(),
            hasStore: true,
        });

        state.status = runCli(state.project, ["build"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("keeps flag-off #data assets and schemas working", () => {
        const run = runApp(state.project);
        expect(state.status).toBe(0);
        expect(run.stderr).toBe("");

        expect(run.stdout).toBe(
            `${APPLICATION_ID} resource://${LEGACY_RESOURCE_PATH} ${LEGACY_RESOURCE_PATH} legacy-png-probe`,
        );

        expect(run.status).toBe(0);
    });

    it("generates exact declarations for the legacy imports", () => {
        const declarations = readFileSync(join(state.project.root, SCHEMA_TYPES), "utf8");
        expect(declarations).toContain('declare module "#data/logo.png"');
        expect(declarations).toContain(`declare module "#data/${SCHEMA_FILE}"`);
    });
});

describe("gtkx codegen (v2 asset import declarations)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-build-types-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: typecheckFiles(),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("types an explicit resource import as a path", () => {
        expect(state.status).toBe(0);
        expect(runTypecheck(state.project, "tsconfig.explicit.json")).toBe(0);
    });

    it("makes a used bare asset import fail typechecking", () => {
        expect(runTypecheck(state.project, "tsconfig.bare.json")).not.toBe(0);
    });
});

describe("gtkx build (a single configured icon)", () => {
    it("places the file in the hicolor application theme", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false", "application.svg"),
            files: { ...appFiles("index.tsx"), "application.svg": "<svg/>\n" },
            hasStore: true,
        });

        installResourcePackage(project);

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            expect(emittedNames(project)).toContain(ICON_PATH);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx build (an entry the command is given)", () => {
    it("builds the named entry", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-entry-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: appFiles("main.tsx"),
            hasStore: true,
        });

        installResourcePackage(project);

        try {
            expect(runCli(project, ["build", "src/main.tsx"]).status).toBe(0);
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

    it("fails over two schema ids that cannot both keep an export name", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-collision-",
            files: { ...appFiles("index.tsx"), [join("data", SCHEMA_FILE)]: COLLIDING_SCHEMA },
        });
    });

    it("fails over a settings schema it cannot parse", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-schema-",
            files: { ...appFiles("index.tsx"), [join("data", SCHEMA_FILE)]: BROKEN_SCHEMA },
        });
    });
});

describe("gtkx build (invalid resources and packaging inputs)", () => {
    it("fails over a bare relative asset while v2 resource imports are enabled", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-bare-asset-",
            files: { ...appFiles("index.tsx"), [join("src", "index.tsx")]: BARE_ASSET_SOURCE },
        });
    });

    it("fails when two assets claim the same GResource path", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-resource-collision-",
            files: { ...appFiles("index.tsx"), [join("src", "index.tsx")]: RESOURCE_COLLISION_SOURCE },
        });
    });

    it("fails when a URL asset requests the resource path export", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-url-binding-",
            files: { ...appFiles("index.js"), [join("src", "index.js")]: URL_NAMED_EXPORT_SOURCE },
        });
    });

    it("fails when two imported schemas have the same basename", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-schema-basename-",
            files: {
                ...appFiles("index.tsx"),
                [join("src", "index.tsx")]: DUPLICATE_SCHEMA_SOURCE,
                [join("data", "one", SCHEMA_FILE)]: SCHEMA,
                [join("data", "two", SCHEMA_FILE)]: SCHEMA,
            },
        });
    });

    it("fails when the configured icon path does not exist", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-missing-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false", "missing-icons"),
            files: appFiles("index.tsx"),
        });
    });

    it("fails when the configured icon file has an unsupported format", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-unsupported-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false", "application.jpg"),
            files: { ...appFiles("index.tsx"), "application.jpg": "jpeg\n" },
        });
    });

    it("fails when an imported schema is outside the project", () => {
        expectOutsideSchemaBuildFailure();
    });
});
