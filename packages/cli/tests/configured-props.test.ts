import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCli, runCliOrThrow } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    readButton,
    runDocs,
    stamp,
    UNION_MODULE,
    writePropsConfig,
} from "./configured-props-fixture.js";
import { isolateTypeConsumer } from "./type-consumer.js";

type PackageManifest = { name: string; files: string[]; dependencies: Record<string, string> };
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const VITEST_PACKAGE = dirname(fileURLToPath(import.meta.resolve("vitest/package.json")));
const COPIED_PACKAGES: Set<string> = new Set(["@gtkx/cli", "@gtkx/codegen"]);
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
    it("follows current GIR inputs after generating a store and preserves declaration errors", () => {
        using project = createCliProject({ prefix: "gtkx-props-generated-store-" });
        const earlier = join(project.root, "earlier");
        const later = join(project.root, "later");
        const moduleName = "@audit/gir-props";
        const moduleRoot = join(project.nodeModules, moduleName);
        mkdirSync(earlier);
        mkdirSync(later);
        mkdirSync(moduleRoot, { recursive: true });
        const gir = readFileSync(new URL("fixtures/gir/ReferenceProps-1.0.gir", import.meta.url), "utf8");
        const filename = "ReferenceProps-1.0.gir";
        writeFileSync(join(later, filename), gir);
        writeFileSync(join(moduleRoot, "package.json"), JSON.stringify({
            name: moduleName,
            version: "1.0.0",
            type: "module",
            exports: { ".": { types: "./index.d.ts" } },
        }));
        const declaration = 'import type * as ReferenceProps from "@gtkx/gi/referenceprops";\n' +
            'export interface Props { auditValue: ReturnType<ReferenceProps.Probe["getValue"]>; }\n';
        const declarationPath = join(moduleRoot, "index.d.ts");
        writeFileSync(declarationPath, declaration);
        const config = {
            applicationId: "org.gtkx.referenceprops",
            libraries: ["ReferenceProps-1.0"],
            girPath: [earlier, later],
            agents: { rules: false, reference: false },
            elements: { config: { GtkButton: { props: { module: moduleName, export: "Props" } } } },
        };
        writeFileSync(join(project.root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
        runCliOrThrow(project, ["codegen"]);
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("string");
        const selected = join(earlier, filename);
        writeFileSync(selected, gir.replace('<type name="utf8" c:type="const gchar*"/>',
            '<type name="gint" c:type="gint"/>'));
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("number");
        rmSync(selected);
        runDocs(project);
        expect(documentedType(readButton(project.root), "auditValue")).toBe("string");
        const before = readButton(project.root);
        writeFileSync(declarationPath, declaration.replace('Probe["getValue"]', 'Probe["absent"]'));
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
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
});
