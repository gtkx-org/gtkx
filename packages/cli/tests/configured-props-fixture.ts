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
import { type CliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

type PackageManifest = { name: string; files: string[]; dependencies: Record<string, string> };

const FIXTURE = fileURLToPath(new URL("fixtures/configured-props/@audit", import.meta.url));
const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const VITEST_PACKAGE = dirname(fileURLToPath(import.meta.resolve("vitest/package.json")));
const COPIED_PACKAGES: Set<string> = new Set(["@gtkx/cli", "@gtkx/codegen"]);
const OUTPUT = "docs/reference";
const BOX_PAGE = "gtk/box.md";
const BUTTON_PAGE = "gtk/button.md";
const PROPS_MODULE = "@audit/element-props";
const UNION_MODULE = "@audit/union-props";
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
const METADATA_CONSUMER = `import { GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import type { GtkButtonProps, GtkToggleButtonProps } from "@gtkx/jsx/gtk";
import type { ConstructOnlyPropNames } from "@gtkx/react/internal";
import { expectTypeOf } from "vitest";

type IsConstructOnly = "auditCaption" extends ConstructOnlyPropNames<GtkButtonProps> ? true : false;
expectTypeOf<IsConstructOnly>().toEqualTypeOf<true>();
expectTypeOf<GtkButtonProps>().toHaveProperty("auditCaption");
expectTypeOf<GtkToggleButtonProps>().not.toHaveProperty("auditCaption");
export const button = <GtkButton label="Run" auditCaption="Example" />;
export const toggle = <GtkToggleButton label="Toggle" />;
`;

const readButton = (root: string, directory = OUTPUT): string =>
    readFileSync(join(root, directory, BUTTON_PAGE), "utf8");

const stamp = (root: string): number => statSync(join(root, OUTPUT, BUTTON_PAGE)).mtimeMs;

const installConfiguredProps = (root: string): void => {
    cpSync(FIXTURE, join(root, "node_modules", "@audit"), { recursive: true });
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

const writePropsConfig = (root: string, exportName = "AliasProps", moduleName = PROPS_MODULE): void => {
    const config = {
        applicationId: "org.gtkx.configuredprops",
        agents: { rules: false, reference: true },
        elements: { config: { GtkButton: { props: { module: moduleName, export: exportName } } } },
    };
    writeFileSync(join(root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
};

const writeMetadataConfig = (root: string): void => {
    const config = {
        applicationId: "org.gtkx.configuredpropsmetadata",
        agents: { rules: false, reference: true },
        elements: {
            config: {
                GtkBox: { acceptedChildTypes: ["GtkLabel"] },
                GtkButton: {
                    props: {
                        module: PROPS_MODULE,
                        export: "AliasProps",
                        composition: "factory",
                        constructOnly: ["auditCaption"],
                    },
                },
            },
        },
    };
    writeFileSync(join(root, "gtkx.config.mjs"), `export default ${JSON.stringify(config)};\n`);
};

const runDocs = (project: CliProject): void => {
    runCliOrThrow(project, ["docs", "--out", OUTPUT]);
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

const typecheckMetadataConsumer = (project: CliProject): void => {
    typecheckConsumer(project, METADATA_CONSUMER);
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

export {
    BOX_PAGE,
    documentedType,
    installConfiguredProps,
    installHoistedToolchain,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    stamp,
    typecheckConsumer,
    typecheckMetadataConsumer,
    UNION_MODULE,
    unionConsumer,
    writeMetadataConfig,
    writePropsConfig,
};
