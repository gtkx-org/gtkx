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
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

type PackageManifest = { name: string; files: string[]; dependencies: Record<string, string> };

const FIXTURE = fileURLToPath(new URL("fixtures/configured-props/@audit", import.meta.url));
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const VITEST_PACKAGE = dirname(fileURLToPath(import.meta.resolve("vitest/package.json")));
const OUTPUT = "docs/reference";
const BUTTON_PAGE = "gtk/button.md";
const PROPS_MODULE = "@audit/element-props";
const COPIED_PACKAGES: Set<string> = new Set(["@gtkx/cli", "@gtkx/codegen"]);
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

const typecheckConsumer = (project: CliProject): void => {
    isolateTypeConsumer(project);
    symlinkSync(VITEST_PACKAGE, join(project.nodeModules, "vitest"), "dir");
    writeFileSync(join(project.root, "consumer.tsx"), CONSUMER);

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

describe("configured element prop reference", () => {
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
