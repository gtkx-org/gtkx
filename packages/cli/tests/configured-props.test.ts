import { spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    statSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCli, runCliOrThrow, startCli } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

type PackageManifest = { name: string; files: string[]; dependencies: Record<string, string> };

const FIXTURE = fileURLToPath(new URL("fixtures/configured-props/@audit", import.meta.url));
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const VITEST_PACKAGE = dirname(fileURLToPath(import.meta.resolve("vitest/package.json")));
const OUTPUT = "docs/reference";
const BUTTON_PAGE = "gtk/button.md";
const PROPS_MODULE = "@audit/element-props";
const UNION_MODULE = "@audit/union-props";
const COPIED_PACKAGES: Set<string> = new Set(["@gtkx/cli", "@gtkx/codegen"]);
const READ_BARRIER = `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const read = fs.readFileSync;
const wait = new Int32Array(new SharedArrayBuffer(4));
let entered = false;
fs.readFileSync = (file, ...args) => {
    const result = read(file, ...args);
    if (!entered && file === process.env.GTKX_PROPS_INPUT) {
        entered = true;
        fs.writeFileSync(process.env.GTKX_PROPS_READY, "");
        while (!fs.existsSync(process.env.GTKX_PROPS_RELEASE)) {
            Atomics.wait(wait, 0, 0, 10);
        }
    }
    return result;
};
syncBuiltinESMExports();
`;
const BASE_DECLARATION = "export interface SharedProps<T> { auditReplacement: T; }\n";
const REEXPORT_DECLARATION = "export interface ReexportedProps { auditEarlier?: Date; }\n";
const INVALID_DECLARATION = 'import type * as Gtk from "@gtkx/gi/gtk";\n' +
    "export interface AliasProps { auditWidget: Gtk.Absent; }\n";
const CONSUMER = `import { GtkButton } from "@gtkx/jsx/gtk";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ComponentProps } from "react";
import { expectTypeOf } from "vitest";

type Props = ComponentProps<typeof GtkButton>;
expectTypeOf<Props["auditCaption"]>().toEqualTypeOf<string>();
expectTypeOf<Props["auditWidget"]>().toEqualTypeOf<Gtk.Widget | null | undefined>();
expectTypeOf<Props["auditCallback"]>().toEqualTypeOf<((widget: Gtk.Widget) => boolean) | undefined>();
expectTypeOf<Props>().not.toHaveProperty("auditCount");
export const button = <GtkButton label="Run" auditCaption="Example" auditMode="quiet" audit-enabled />;
`;
const INVALID_PROPS = [
    { title: "an uninstalled package", module: "@audit/not-installed", exported: "Props" },
    { title: "a missing export", module: PROPS_MODULE, exported: "MissingProps" },
    { title: "a value-only export", module: PROPS_MODULE, exported: "ValueProps" },
    { title: "a function export", module: PROPS_MODULE, exported: "FunctionProps" },
];

const readButton = (root: string, directory = OUTPUT): string =>
    readFileSync(join(root, directory, BUTTON_PAGE), "utf8");

const stamp = (root: string): number => statSync(join(root, OUTPUT, BUTTON_PAGE)).mtimeMs;

const installConfiguredProps = (root: string): void => {
    cpSync(FIXTURE, join(root, "node_modules", "@audit"), { recursive: true });
};

const writePropsConfig = (root: string, exportName = "AliasProps", moduleName = PROPS_MODULE): void => {
    const config = {
        applicationId: "org.gtkx.configuredprops",
        agents: { rules: false, reference: true },
        elements: { config: { GtkButton: { props: { module: moduleName, export: exportName } } } },
    };
    writeFileSync(join(root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
};

const runDocs = (project: CliProject): void => {
    runCliOrThrow(project, ["docs", "--out", OUTPUT]);
};

const linkHoistedDependencies = (project: CliProject, source: string, manifest: PackageManifest): void => {
    for (const dependency of Object.keys(manifest.dependencies)) {
        const target = join(project.nodeModules, dependency);

        if (COPIED_PACKAGES.has(dependency) || existsSync(target)) {
            continue;
        }

        mkdirSync(dirname(target), { recursive: true });
        symlinkSync(realpathSync(join(source, "node_modules", dependency)), target, "dir");
    }
};

const installHoistedToolchain = (project: CliProject): void => {
    for (const name of COPIED_PACKAGES) {
        const source = fileURLToPath(new URL(`../../${name.slice("@gtkx/".length)}`, import.meta.url));
        const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8")) as PackageManifest;
        const directory = join(project.nodeModules, manifest.name);
        mkdirSync(directory, { recursive: true });

        for (const file of ["package.json", ...manifest.files]) {
            cpSync(join(source, file), join(directory, file), { recursive: true });
        }

        linkHoistedDependencies(project, source, manifest);
    }
};

const typecheckConsumer = (project: CliProject, source = CONSUMER): void => {
    isolateTypeConsumer(project);
    symlinkSync(VITEST_PACKAGE, join(project.nodeModules, "vitest"), "dir");
    writeFileSync(join(project.root, "consumer.tsx"), source);

    const result = spawnSync(process.execPath, [
        TYPESCRIPT_CLI,
        "--noEmit",
        "--module", "ESNext",
        "--moduleResolution", "Bundler",
        "--target", "ESNext",
        "--jsx", "react-jsx",
        "--strict",
        "--exactOptionalPropertyTypes",
        "--noUncheckedIndexedAccess",
        "--skipLibCheck", "false",
        "--types", "node",
        "consumer.tsx",
    ], { cwd: project.root, encoding: "utf8" });

    if (result.status !== 0) {
        throw new Error(result.stdout + result.stderr);
    }
};

const documentedType = (page: string, name: string): string => {
    const [line] = page.split("### `" + name + "`\n\n")[1]?.split("\n") ?? [];

    if (line === undefined) {
        throw new Error("No documented prop type");
    }

    return line.slice(1, -1);
};

const unionConsumer = (project: CliProject, page: string): string => {
    const source = readFileSync(join(project.nodeModules, UNION_MODULE, "consumer.tsx.txt"), "utf8");
    const names = ["auditCall", "auditDynamic", "auditIntersection", "auditOverlap", "auditShared", "auditValue", "0"];
    const checks = names.map((name, index) =>
        "type Documented" + String(index) + " = " + documentedType(page, name) + ";\n" +
        "expectTypeOf<Documented" + String(index) + ">().toEqualTypeOf<NonNullable<Label[\"" + name +
        "\"] | Count[\"" + name + "\"]>>();");
    const detail = "type DocumentedDetail = " + documentedType(page, "audit-label-detail-${string}") + ";\n" +
        "expectTypeOf<DocumentedDetail>().toEqualTypeOf<Label[`audit-label-detail-${string}`] | " +
        "Count[`audit-label-detail-${string}`]>();";

    return [source, ...checks, detail].join("\n");
};

describe("configured element prop reference", () => {
    it("refreshes after a declaration changes during the first documentation build", async () => {
        using project = createCliProject({ prefix: "gtkx-props-snapshot-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        const declaration = join(project.nodeModules, "@audit/element-base/index.d.ts");
        const barrier = join(project.root, "read-barrier.mjs");
        const ready = join(project.root, "read-ready");
        const released = join(project.root, "read-release");
        writeFileSync(barrier, READ_BARRIER);
        const child = startCli(project, ["docs", "--out", OUTPUT], {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${pathToFileURL(barrier).href}`,
            GTKX_PROPS_INPUT: declaration,
            GTKX_PROPS_READY: ready,
            GTKX_PROPS_RELEASE: released,
        });
        const closed: Promise<number | null> = new Promise((resolve, reject) => {
            child.once("error", (error) => {
                reject(error);
            });
            child.once("close", (status) => {
                resolve(status);
            });
        });

        try {
            await expect.poll(() => existsSync(ready), { timeout: 60_000 }).toBe(true);
            writeFileSync(declaration, BASE_DECLARATION);
            writeFileSync(released, "");
            const status = await closed;
            expect(status).toBe(0);
            expect(readButton(project.root)).toContain("### `auditCaption`");
            runDocs(project);
            expect(readButton(project.root)).toContain("### `auditReplacement`");
            expect(readButton(project.root)).not.toContain("### `auditCaption`");
        } finally {
            writeFileSync(released, "");

            if (child.exitCode === null && child.signalCode === null) {
                child.kill("SIGTERM");
                await closed;
            }
        }
    });

    it.each(["utf8", "utf16le"] as const)("keeps unchanged %s BOM declarations cached", (encoding) => {
        using project = createCliProject({ prefix: "gtkx-props-bom-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        const declaration = join(project.nodeModules, "@audit/element-base/index.d.ts");
        writeFileSync(declaration, "\u{FEFF}" + readFileSync(declaration, "utf8"), encoding);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditCaption`");
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
    });

    it("documents and emits discriminated unions with inherited and overlapping indexed props", () => {
        using project = createCliProject({ prefix: "gtkx-props-union-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "UnionProps", UNION_MODULE);
        runDocs(project);
        const page = readButton(project.root);

        for (const name of ["auditCount", "auditFlag", "auditLabel"]) {
            expect(page).toContain("### `" + name + "`");
        }

        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
        runCliOrThrow(project, ["codegen"]);
        expect(readButton(project.root, ".gtkx/reference")).toContain("### `auditLabel`");
        typecheckConsumer(project, unionConsumer(project, page));
    });

    it("rejects an invalid union branch and recovers without replacing valid pages", () => {
        using project = createCliProject({ prefix: "gtkx-props-union-invalid-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "UnionProps", UNION_MODULE);
        runDocs(project);
        const before = readButton(project.root);
        const declaration = join(project.nodeModules, UNION_MODULE, "index.d.ts");
        const source = readFileSync(declaration, "utf8");
        writeFileSync(declaration, source.replace("auditFlag: boolean", "auditFlag: Gtk.Absent"));
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
        writeFileSync(declaration, source.replaceAll("auditFlag", "auditUpdated"));
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditUpdated`");
        expect(readButton(project.root)).not.toContain("### `auditFlag`");
    });

    it("documents configured props when the installed toolchain has hoisted dependencies", () => {
        using project = createCliProject({ prefix: "gtkx-props-hoisted-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        installHoistedToolchain(project);
        const result = spawnSync(process.execPath, [
            join(project.nodeModules, "@gtkx/cli/bin/gtkx.js"), "docs", "--out", OUTPUT,
        ], { cwd: project.root, encoding: "utf8", timeout: 120_000 });

        expect(result.status).toBe(0);
        expect(readButton(project.root)).toContain("### `auditCaption`");
        expect(readButton(project.root)).toContain("Gtk.Widget | null");
    });

    it("documents installed interfaces, inherited generics, utility types, and GIR types before codegen", () => {
        using project = createCliProject({ prefix: "gtkx-configured-props-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "ButtonProps");
        runDocs(project);
        const interfacePage = readButton(project.root);
        expect(interfacePage).toContain("### `auditCaption`");
        expect(interfacePage).toContain("### `auditCount`");
        expect(interfacePage).toContain("Gtk.Widget | null");
        writePropsConfig(project.root);
        runDocs(project);
        const aliasPage = readButton(project.root);
        expect(aliasPage).toContain("### `auditCaption`");
        expect(aliasPage).toContain("### `auditMode`");
        expect(aliasPage).toContain("audit-${string}");
        expect(aliasPage).not.toContain("### `auditCount`");
        runCliOrThrow(project, ["codegen"]);
        expect(readButton(project.root, ".gtkx/reference")).toContain("### `auditCaption`");
        expect(readButton(project.root, ".gtkx/reference")).not.toContain("### `auditCount`");
        typecheckConsumer(project);
    });

    it("invalidates cached pages when a transitive declaration changes", () => {
        using project = createCliProject({ prefix: "gtkx-props-freshness-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
        writeFileSync(join(project.nodeModules, "@audit/element-base/index.d.ts"), BASE_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReplacement`");
        expect(readButton(project.root)).not.toContain("### `auditCaption`");
    });

    it("follows reexports when an earlier declaration source appears", () => {
        using project = createCliProject({ prefix: "gtkx-props-reexport-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "ReexportedProps");
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReexported`");
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "reexport.ts"), REEXPORT_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditEarlier`");
        expect(readButton(project.root)).not.toContain("### `auditReexported`");
    });

    it.each(INVALID_PROPS)("rejects $title without replacing prior pages", ({ module, exported }) => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writePropsConfig(project.root, exported, module);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });

    it("rejects an absent GIR type without replacing prior pages", () => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-type-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "index.d.ts"), INVALID_DECLARATION);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });
});
