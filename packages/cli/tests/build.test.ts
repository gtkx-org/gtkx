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
    runCliOrThrow,
    STORE_LIBRARIES,
} from "./cli-project.js";

type AppRun = { status: number | null; stdout: string; stderr: string };
type BrokenEntry = { title: string; args: string[] };
type BrokenBuild = { config?: string | undefined; files: Record<string, string>; prefix: string };

type BuildMetadata = {
    generator: string;
    formatVersion: number;
    schemas: string[];
    packages: { name: string; version: string | null; dir: string }[];
};

const APPLICATION_ID = "com.gtkx.clibuild";
const READY_MARKER = "app-ready";
const RUN_TIMEOUT = 60_000;
const OUT_DIR = "dist";
const BUNDLE = "bundle.mjs";
const BUILD_METADATA = "gtkx-schemas.json";
const SCHEMA_FILE = `${APPLICATION_ID}.gschema.xml`;
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);

const EMITTED = [
    "bundle.mjs",
    "gtkx.node",
    "gtkx.gresource",
    "gschemas.compiled",
    BUILD_METADATA,
    ICON_PATH,
];

const SCHEMA_TYPES = join("node_modules", ".gtkx", "env.d.ts");
const FOLDERS_ID = `${APPLICATION_ID}.app-folders`;
const FOLDER_CHILD = "probe-folder";
const EXPLICIT_RESOURCE_PATH = "/com/gtkx/clibuild/explicit-logo.png";
const DERIVED_RESOURCE_PATH = "/com/gtkx/clibuild/data/logo.png";
const PACKAGE_NAME = "@probe/resource-package";
const PACKAGE_RESOURCE_PATH = `/com/gtkx/clibuild/${PACKAGE_NAME}/icons/star.svg`;
const SIDE_EFFECT_ICON_PACKAGE = "@probe/side-effect-icon-package";
const SIDE_EFFECT_ICON_NAME = "gtkx-side-effect-probe";
const LOCAL_ICON_NAME = "gtkx-local-probe-symbolic";
const DIRECT_ICON_NAME = "gtkx-direct-probe";
const PACKAGE_ICON_NAME = "gtkx-package-probe";
const VARIANT_ICON_NAME = "gtkx-variant-probe";
const LOCAL_ICON_RESOURCE_PATH = `/com/gtkx/clibuild/icons/scalable/actions/${LOCAL_ICON_NAME}.svg`;
const DIRECT_ICON_RESOURCE_PATH = `/com/gtkx/clibuild/icons/${DIRECT_ICON_NAME}.svg`;
const PACKAGE_ICON_RESOURCE_PATH = `/com/gtkx/clibuild/icons/16x16/actions/${PACKAGE_ICON_NAME}.svg`;
const FIXED_VARIANT_RESOURCE_PATH = `/com/gtkx/clibuild/icons/16x16/actions/${VARIANT_ICON_NAME}.png`;
const SCALABLE_VARIANT_RESOURCE_PATH = `/com/gtkx/clibuild/icons/scalable/actions/${VARIANT_ICON_NAME}.svg`;
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>\n';

const BROKEN_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}">
`;

const MANIFEST = {
    name: "gtkx-cli-build",
    version: "1.0.0",
    type: "module",
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
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit, useSetting } from "@gtkx/react";
import packageResourcePath, { packageIconName } from "${PACKAGE_NAME}";
import { readFileSync } from "node:fs";
import { useEffect } from "react";
import schema, { com_gtkx_clibuild_appFolders as folders } from "../data/${SCHEMA_FILE}";
import logoPath, { path as namedLogoPath } from "../data/logo.png?resource";
import logoFile from "../data/logo.png?url";
import explicitLogoPath from "../data/explicit.png?resource=${EXPLICIT_RESOURCE_PATH}";
import localIconName from "../data/assets/icons/hicolor/scalable/actions/${LOCAL_ICON_NAME}.svg?icon";
import directIconName from "../data/direct.svg?icon=${DIRECT_ICON_NAME}";
import fixedVariant from "../data/variants/icons/16x16/actions/fixed.png?icon=${VARIANT_ICON_NAME}";
import scalableVariant from "../data/variants/icons/scalable/actions/scalable.svg?icon=${VARIANT_ICON_NAME}";

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
        const display = Gdk.Display.getDefault();
        const iconTheme = display === null ? null : Gtk.IconTheme.getForDisplay(display);
        const packageIcon = iconTheme?.lookupIcon(
            packageIconName,
            null,
            16,
            1,
            Gtk.TextDirection.NONE,
            Gtk.IconLookupFlags.NONE,
        );
        const packageIconUri = packageIcon?.getFile()?.getUri() ?? "missing";
        const iconResourcesLoaded = [
            "${LOCAL_ICON_RESOURCE_PATH}",
            "${DIRECT_ICON_RESOURCE_PATH}",
            "${PACKAGE_ICON_RESOURCE_PATH}",
            "${FIXED_VARIANT_RESOURCE_PATH}",
            "${SCALABLE_VARIANT_RESOURCE_PATH}",
        ].every((path) => (Gio.resourcesLookupData(path, Gio.ResourceLookupFlags.NONE).getData() ?? []).length > 0);
        process.stdout.write(
            "${READY_MARKER} " + String(counter) + " " + children.join(",") + " " + logoPath + " " +
            namedLogoPath + " " + explicitLogoPath + " " + emittedLogo + " " + bundledLogo + " " +
            packageResourcePath + " " + packageResource + " " + localIconName + " " + directIconName + " " +
            packageIconName + " " + String(iconTheme?.hasIcon(localIconName) === true) + " " +
            String(iconTheme?.hasIcon(directIconName) === true) + " " +
            String(iconTheme?.hasIcon(packageIconName) === true) + " " + String(iconResourcesLoaded) + " " +
            String(fixedVariant === scalableVariant) + " " + packageIconUri + "\n",
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

const EXPLICIT_TYPE_SOURCE = `import logo from "../data/logo.png?resource=/com/gtkx/type-probe.png";
import iconName from "../data/type.svg?icon=gtkx-type-probe";

const path: string = logo;
const name: string = iconName;
export { name, path };
`;

const RESOURCE_COLLISION_SOURCE = `import first from "../data/logo.png?resource=/com/gtkx/collision.png";
import second from "../data/explicit.png?resource=/com/gtkx/collision.png";

process.stdout.write(first + second);
`;

const ICON_COLLISION_SOURCE = `import first from "../data/first.svg?icon=gtkx-collision";
import second from "../data/second.svg?icon=gtkx-collision";

process.stdout.write(first + second);
`;

const INVALID_ICON_NAME_SOURCE = `import iconName from "../data/first.svg?icon=invalid.svg";

process.stdout.write(iconName);
`;

const UNSUPPORTED_ICON_SOURCE = `import iconName from "../data/photo.jpg?icon";

process.stdout.write(iconName);
`;

const ICON_FORMAT_COLLISION_SOURCE = `import vector from "../data/format.svg?icon=gtkx-format-collision";
import bitmap from "../data/format.png?icon=gtkx-format-collision";

process.stdout.write(vector + bitmap);
`;

const LAZY_ICON_NAME = "gtkx-lazy-probe";

const LAZY_ICON_SOURCE = `const { default: iconName } = await import("../data/lazy.svg?icon=${LAZY_ICON_NAME}");

process.stdout.write(iconName);
`;

const SIDE_EFFECT_ICON_APP_SOURCE = `import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useEffect } from "react";
import { probeValue } from "${SIDE_EFFECT_ICON_PACKAGE}";

const App = () => {
    useEffect(() => {
        const display = Gdk.Display.getDefault();
        const theme = display === null ? null : Gtk.IconTheme.getForDisplay(display);
        process.stdout.write(
            String(probeValue) + " ${SIDE_EFFECT_ICON_NAME} " +
            String(theme?.hasIcon("${SIDE_EFFECT_ICON_NAME}") === true),
        );
        quit();
    }, []);

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Probe" />
        </GtkApplication>
    );
};

createRoot().render(<App />);
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

const config = (libraries: string[], body = "", applicationIcon: string | null = "data/icons"): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(libraries)}` +
    (applicationIcon === null ? "" : `, applicationIcon: ${JSON.stringify(applicationIcon)}`) +
    `${body} };\n`;

const appFiles = (entry: string): Record<string, string> => ({
    "package.json": `${JSON.stringify(MANIFEST, null, 4)}\n`,
    [join("data", SCHEMA_FILE)]: SCHEMA,
    [join("data", ICON_PATH)]: "<svg/>\n",
    [join("data", "logo.png")]: "png-probe\n",
    [join("data", "explicit.png")]: "explicit-png-probe\n",
    [join("data", "assets", "icons", "hicolor", "scalable", "actions", `${LOCAL_ICON_NAME}.svg`)]: SVG,
    [join("data", "direct.svg")]: SVG,
    [join("data", "variants", "icons", "16x16", "actions", "fixed.png")]: "png-probe\n",
    [join("data", "variants", "icons", "scalable", "actions", "scalable.svg")]: SVG,
    [join("src", entry)]: APP_SOURCE,
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
        [join("data", "type.svg")]: SVG,
        [join("src", "bare.ts")]: BARE_ASSET_SOURCE,
        [join("src", "explicit.ts")]: EXPLICIT_TYPE_SOURCE,
        "tsconfig.bare.json": tsconfig("src/bare.ts"),
        "tsconfig.explicit.json": tsconfig("src/explicit.ts"),
    };
};

const emittedNames = (project: CliProject): string[] => listProjectFiles(project, OUT_DIR);

const expectUnifiedBuildMetadata = (project: CliProject): void => {
    const contents = readFileSync(join(project.root, OUT_DIR, BUILD_METADATA), "utf8");
    const metadata = JSON.parse(contents) as BuildMetadata;
    expect(metadata.generator).toBe("gtkx-build");
    expect(metadata.formatVersion).toBe(1);
    expect(metadata.schemas).toEqual([join("data", SCHEMA_FILE)]);

    expect(metadata.packages).toEqual(expect.arrayContaining([
        { name: MANIFEST.name, version: MANIFEST.version, dir: ".." },
        {
            name: PACKAGE_NAME,
            version: null,
            dir: join("..", "node_modules", "@probe", "resource-package"),
        },
    ]));

    expect(emittedNames(project)).not.toContain("gtkx-packages.json");
};

const installResourcePackage = (project: CliProject): void => {
    const packageDir = join(project.nodeModules, PACKAGE_NAME);
    const iconDir = join(packageDir, "icons");
    const themedIconDir = join(iconDir, "16x16", "actions");
    mkdirSync(themedIconDir, { recursive: true });

    writeFileSync(
        join(packageDir, "package.json"),
        `${JSON.stringify({ name: PACKAGE_NAME, type: "module", exports: "./index.js" }, null, 4)}\n`,
    );

    writeFileSync(
        join(packageDir, "index.js"),
        "import path from \"./icons/star.svg?resource\";\n" +
        `import packageIconName from "./icons/16x16/actions/package.svg?icon=${PACKAGE_ICON_NAME}";\n` +
        "export { packageIconName };\nexport default path;\n",
    );

    writeFileSync(join(iconDir, "star.svg"), "package-svg-probe\n");
    writeFileSync(join(themedIconDir, "package.svg"), SVG);
};

const installSideEffectIconPackage = (project: CliProject): void => {
    const packageDir = join(project.nodeModules, SIDE_EFFECT_ICON_PACKAGE);
    const iconDir = join(packageDir, "icons");
    mkdirSync(iconDir, { recursive: true });

    writeFileSync(
        join(packageDir, "package.json"),
        `${JSON.stringify({
            name: SIDE_EFFECT_ICON_PACKAGE,
            type: "module",
            exports: "./index.js",
            sideEffects: false,
        }, null, 4)}\n`,
    );

    writeFileSync(
        join(packageDir, "index.js"),
        `import "./icons/probe.svg?icon=${SIDE_EFFECT_ICON_NAME}";\nexport const probeValue = 7;\n`,
    );

    writeFileSync(join(iconDir, "probe.svg"), SVG);
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
        expect(() => runCliOrThrow(project, ["build"])).toThrow();
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
        expect(declarations).toContain(`declare module "*?icon=${DIRECT_ICON_NAME}"`);
    });

    it("records the schemas and packages reached by the bundle in one build metadata file", () => {
        expectUnifiedBuildMetadata(state.project);
    });

    it("emits a bundle that starts, reads its settings and reaches its resources", () => {
        const run = runApp(state.project);
        expect(run.stderr).toBe("");
        expect(run.stdout).toContain(`${READY_MARKER} 7 ${FOLDER_CHILD} `);

        expect(run.stdout).toContain(
            `${DERIVED_RESOURCE_PATH} ${DERIVED_RESOURCE_PATH} ${EXPLICIT_RESOURCE_PATH} png-probe png-probe`,
        );

        expect(run.stdout).toContain(`${PACKAGE_RESOURCE_PATH} package-svg-probe`);

        expect(run.stdout).toContain(
            `${LOCAL_ICON_NAME} ${DIRECT_ICON_NAME} ${PACKAGE_ICON_NAME} true true true true true ` +
            `resource://${PACKAGE_ICON_RESOURCE_PATH}`,
        );

        expect(run.status).toBe(0);
    });
});

describe("gtkx codegen (asset import declarations)", () => {
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

describe("gtkx codegen (imports under hidden directories)", () => {
    it("ignores schema imports a hidden directory holds", () => {
        const hiddenSchema = "hidden-probe.gschema.xml";

        const project = createCliProject({
            prefix: "gtkx-cli-build-hidden-",
            config: config(STORE_LIBRARIES, ", codegen: false", null),
            files: {
                [join("src", "index.tsx")]: `import "../data/${SCHEMA_FILE}";\n`,
                [join("data", SCHEMA_FILE)]: SCHEMA,
                [join("src", ".stash", "copy.tsx")]: `import "./${SCHEMA_FILE}";\nimport "./${hiddenSchema}";\n`,
                [join("src", ".stash", SCHEMA_FILE)]: SCHEMA,
                [join("src", ".stash", hiddenSchema)]: SCHEMA,
            },
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const declarations = readFileSync(join(project.root, SCHEMA_TYPES), "utf8");
            expect(declarations).toContain(`declare module "*/${SCHEMA_FILE}"`);
            expect(declarations).not.toContain(hiddenSchema);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx build (application icons)", () => {
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

    it("uses an application-id icon in the project root by default", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-default-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false", null),
            files: { ...appFiles("index.tsx"), [`${APPLICATION_ID}.svg`]: "<svg/>\n" },
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

describe("gtkx build (a lazy resource-backed icon)", () => {
    it("loads the icon from an emitted chunk", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-lazy-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: {
                ...appFiles("index.tsx"),
                [join("data", "lazy.svg")]: SVG,
                [join("src", "index.tsx")]: LAZY_ICON_SOURCE,
            },
            hasStore: true,
        });

        installResourcePackage(project);

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            const emitted = emittedNames(project);
            expect(emitted).toContain("gtkx.node");
            expect(emitted).toContain("gtkx.gresource");
            expect(emitted.some((name) => name.startsWith("assets/") && name.endsWith(".mjs"))).toBe(true);
            const run = runApp(project);
            expect(run.stderr).toBe("");
            expect(run.stdout).toBe(LAZY_ICON_NAME);
            expect(run.status).toBe(0);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx build (a side-effect-only dependency icon)", () => {
    it("retains the icon from a side-effect-free package", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-build-side-effect-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
            files: {
                ...appFiles("index.tsx"),
                [join("src", "index.tsx")]: SIDE_EFFECT_ICON_APP_SOURCE,
            },
            hasStore: true,
        });

        installSideEffectIconPackage(project);

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            const run = runApp(project);
            expect(run.stderr).toBe("");
            expect(run.stdout).toBe(`7 ${SIDE_EFFECT_ICON_NAME} true`);
            expect(run.status).toBe(0);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx build (invalid application icons)", () => {
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

    it("fails when multiple default application icons exist", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-ambiguous-icon-",
            config: config(STORE_LIBRARIES, ", codegen: false", null),
            files: {
                ...appFiles("index.tsx"),
                [`${APPLICATION_ID}.svg`]: "<svg/>\n",
                [`${APPLICATION_ID}.png`]: "png\n",
            },
        });
    });
});

describe("gtkx build (projects it refuses to build)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-build-broken-",
            config: config(STORE_LIBRARIES, ", codegen: false"),
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
    it("rejects a schema imported through the legacy data alias", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-data-schema-",
            files: {
                ...appFiles("index.ts"),
                "package.json": `${JSON.stringify({ ...MANIFEST, imports: { "#data/*": "./data/*" } }, null, 4)}\n`,
                [join("src", "index.ts")]: `import "#data/${SCHEMA_FILE}";\n`,
            },
        });
    });

    it("fails over a bare relative asset", () => {
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

    it("fails when an imported schema is outside the project", () => {
        expectOutsideSchemaBuildFailure();
    });
});

describe("gtkx build (invalid resource-backed icons)", () => {
    it("fails when two icons claim the same theme path", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-icon-collision-",
            files: {
                ...appFiles("index.tsx"),
                [join("data", "first.svg")]: SVG,
                [join("data", "second.svg")]: SVG,
                [join("src", "index.tsx")]: ICON_COLLISION_SOURCE,
            },
        });
    });

    it("fails when an icon name includes an image extension", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-invalid-icon-name-",
            files: {
                ...appFiles("index.tsx"),
                [join("data", "first.svg")]: SVG,
                [join("src", "index.tsx")]: INVALID_ICON_NAME_SOURCE,
            },
        });
    });

    it("fails when a themed icon has an unsupported format", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-invalid-icon-format-",
            files: {
                ...appFiles("index.tsx"),
                [join("data", "photo.jpg")]: "jpeg\n",
                [join("src", "index.tsx")]: UNSUPPORTED_ICON_SOURCE,
            },
        });
    });

    it("fails when two formats claim the same icon identity", () => {
        expectBuildFailure({
            prefix: "gtkx-cli-build-icon-format-collision-",
            files: {
                ...appFiles("index.tsx"),
                [join("data", "format.svg")]: SVG,
                [join("data", "format.png")]: "png\n",
                [join("src", "index.tsx")]: ICON_FORMAT_COLLISION_SOURCE,
            },
        });
    });
});
