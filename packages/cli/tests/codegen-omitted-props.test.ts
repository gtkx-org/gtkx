import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow, STORE_LIBRARIES } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const MODULE = "@audit/omitted-props";
const OUTPUT = "docs/reference";
const DECLARATIONS = `export type BranchProps =
    { kind: "text"; text: string } | { kind: "count"; count: number };
export interface ReplacementProps { label?: number; onNotifyLabel?: (value: number) => void; }
export interface EditableExtras { text?: string; onNotifyText?: () => void; extra?: boolean; }
`;
const config = (elements: Record<string, object>, options: object = {}): string => `export default ${JSON.stringify({
    applicationId: "org.gtkx.omittedprops",
    agents: { reference: false, rules: false },
    elements: { config: elements },
    ...options,
})};\n`;

const fixtureFiles = {
    [`node_modules/${MODULE}/package.json`]: JSON.stringify({
        name: MODULE,
        version: "1.0.0",
        type: "module",
        exports: { ".": { types: "./index.d.ts" } },
    }),
    [`node_modules/${MODULE}/index.d.ts`]: DECLARATIONS,
};

describe("configured GIR property omissions", () => {
    it("omits inherited properties and notify handlers without changing parent or interface consumers", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-inherited-",
            config: config({
                GtkToggleButton: { omittedProps: ["label"] },
                GtkEntry: { omittedProps: ["text"] },
                AdwApplicationWindow: { omittedProps: ["title"] },
            }),
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkButton, GtkEntry, GtkSearchEntry, GtkToggleButton } from "@gtkx/jsx/gtk";\n' +
            'import { AdwApplicationWindow } from "@gtkx/jsx/adw";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkButton label="Parent" onNotifyLabel={() => undefined} />,
            <GtkToggleButton active />,
            <GtkEntry visibility />,
            <GtkSearchEntry text="Search" onNotifyText={() => undefined} />,
            <AdwApplicationWindow defaultWidth={400} />,
        ];`)).toBe(0);

        for (const view of [
            '<GtkToggleButton label="Omitted" />',
            "<GtkToggleButton onNotifyLabel={() => undefined} />",
            '<GtkEntry text="Omitted" />',
            "<GtkEntry onNotifyText={() => undefined} />",
            '<AdwApplicationWindow title="Omitted" />',
            "<AdwApplicationWindow onNotifyTitle={() => undefined} />",
        ]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const entry = readFileSync(join(project.root, OUTPUT, "gtk/entry.md"), "utf8");
        const toggle = readFileSync(join(project.root, OUTPUT, "gtk/toggle-button.md"), "utf8");
        expect(entry).not.toContain("### `text`");
        expect(entry).toContain("GIR props omitted from this element: `text`.");
        expect(toggle).toContain("GIR props omitted from this element: `label`.");
        expect(readFileSync(join(project.root, OUTPUT, "gtk/button.md"), "utf8")).toContain("### `label`");
        expect(readFileSync(join(project.root, OUTPUT, "gtk/search-entry.md"), "utf8")).toContain("### `text`");
    });

    it("omits interface prerequisite props while preserving the prerequisite type", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-prerequisite-",
            config: config({ OmittedPropsChild: { omittedProps: ["value"] } }, {
                libraries: [...STORE_LIBRARIES, "OmittedProps-1.0"],
                girPath: ["./gir"],
            }),
            files: {
                "gir/OmittedProps-1.0.gir": readFileSync(new URL("fixtures/gir/OmittedProps-1.0.gir", import.meta.url)),
            },
        });
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        const imports = "import type { OmittedPropsChildProps, OmittedPropsParentProps } " +
            'from "@gtkx/jsx/omittedprops";\n';
        expect(typecheckSource(project, imports + `
            export const parent: OmittedPropsParentProps = { value: 1, onNotifyValue: () => undefined };
            export const child: OmittedPropsChildProps = { active: true };
        `)).toBe(0);
        for (const props of ["{ value: 1 }", "{ onNotifyValue: () => undefined }"]) {
            expect(typecheckSource(project, imports + `export const child: OmittedPropsChildProps = ${props};`))
                .not.toBe(0);
        }
    });

    it("preserves configured replacement props and inherited discriminated branches", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-replacement-",
            config: config({
                GtkButton: { props: { module: MODULE, export: "BranchProps" } },
                GtkToggleButton: {
                    omittedProps: ["label"],
                    props: { module: MODULE, export: "ReplacementProps" },
                },
            }),
            files: fixtureFiles,
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkButton label="Parent" kind="text" text="Text" />,
            <GtkToggleButton label={3} onNotifyLabel={(value) => value.toFixed()} kind="text" text="Text" />,
            <GtkToggleButton label={4} kind="count" count={1} />,
        ];`)).toBe(0);

        for (const view of [
            '<GtkToggleButton label="Omitted" kind="text" text="Text" />',
            '<GtkToggleButton kind="text" count={1} />',
            '<GtkToggleButton kind="count" />',
        ]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const page = readFileSync(join(project.root, OUTPUT, "gtk/toggle-button.md"), "utf8");
        expect(page).toContain("### `label`\n\n`number`");
        expect(page).toContain("### `onNotifyLabel`");
    });

    it("omits inherited configured property entries without changing other consumers", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-interface-props-",
            config: config({
                GtkEditable: { props: { module: MODULE, export: "EditableExtras" } },
                GtkEntry: { omittedProps: ["text"] },
            }),
            files: fixtureFiles,
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkEntry, GtkSearchEntry } from "@gtkx/jsx/gtk";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkEntry extra visibility />,
            <GtkSearchEntry text="Search" onNotifyText={() => undefined} extra />,
        ];`)).toBe(0);
        for (const view of ['<GtkEntry text="Omitted" />', "<GtkEntry onNotifyText={() => undefined} />"]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const entry = readFileSync(join(project.root, OUTPUT, "gtk/entry.md"), "utf8");
        const search = readFileSync(join(project.root, OUTPUT, "gtk/search-entry.md"), "utf8");
        for (const name of ["text", "onNotifyText"]) {
            expect(entry).not.toContain("### `" + name + "`");
            expect(search).toContain("### `" + name + "`");
        }
        expect(entry).toContain("### `extra`");
    });
});
