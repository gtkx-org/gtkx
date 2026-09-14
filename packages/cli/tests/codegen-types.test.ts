import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli, STORE_LIBRARIES } from "./cli-project.js";

const WORKSPACE = fileURLToPath(new URL("../../..", import.meta.url));
const TYPESCRIPT_CLI = join(WORKSPACE, "node_modules/typescript/bin/tsc");
const PACKAGES = ["cairo", "components", "config", "css", "forms", "native", "react", "runtime", "utils"];
const ACCEPTED = `import type { ComboRowProps, DropDownProps, ListViewProps } from "@gtkx/components";
import { Dialog, SpinRow, SplitButton } from "@gtkx/gi/adw";
import { Action, DBusInterfaceSkeleton, type DBusInterfaceInfo, SimpleAction } from "@gtkx/gi/gio";
import { ArrowType, Box, Button, CellAreaBox, CellRendererText, Orientation } from "@gtkx/gi/gtk";
import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
import { GtkCallbackAction, GtkKeyvalTrigger, GtkShortcutTrigger } from "@gtkx/jsx/gtk";
import { createElement } from "react";

declare const dialog: Dialog;
declare const row: SpinRow;
declare const skeleton: DBusInterfaceSkeleton;
declare const action: SimpleAction;
declare const button: Button;

export const mixedIn = new Box({ orientation: Orientation.VERTICAL }).getOrientation();
export const direction: ArrowType = new SplitButton().getDirection();
export const activated: void = row.activate();
export type ClickResult = ReturnType<typeof button.emit<"clicked">>;
export const emitted = button.emit<"clicked">("clicked");
export const interfaceMembers = [dialog.vfuncAddController, action.getName()];
export const info: DBusInterfaceInfo = skeleton.getInfo();
action.enabled = true;
export const selections: AdwToggleGroupProps[] = [{}, { active: 0 }, { activeName: "first" }];
export const cells = new CellAreaBox().packStart(new CellRendererText(), true, false, false);
export const shortcutElements = [
    createElement(GtkShortcutTrigger, { accelerator: "<Control>s" }),
    createElement(GtkCallbackAction, { callback: () => true }),
    createElement(GtkKeyvalTrigger, { keyval: 65 }),
];
export const dropDownProps: DropDownProps<string> = {
    items: [{ id: "first", value: "First" }],
    selectedId: "first",
    onSelectionChanged: (id) => id,
};
export const comboRowProps: ComboRowProps<string> = {
    items: [{ id: "first", value: "First" }],
    selectedId: "first",
    onSelectionChanged: (id) => id,
};
export const emptyDropDown: DropDownProps = {};
export const emptyComboRow: ComboRowProps = {};
export const structuredDropDown: DropDownProps<{ label: string }> = {
    items: [{ id: "first", value: { label: "First" } }],
    renderItem: ({ item }) => item.label,
};
export const primitiveComboRow: ComboRowProps<string | number | boolean | bigint | symbol | null | undefined> = {
    items: ["First", 0, false, 42n, Symbol("choice"), null, undefined].map((value, index) => ({
        id: String(index), value,
    })),
};
export const collectionSources: ListViewProps<string, string>[] = [
    { renderItem: () => null },
    { items: [{ id: "first", value: "First" }], renderHeader: null, renderItem: ({ item }) => item },
    {
        sections: [{ id: "group", value: "Group", data: [{ id: "first", value: "First" }] }],
        renderHeader: ({ section }) => section,
        renderItem: ({ item }) => item,
    },
];

export function interfaceName(value: unknown): string {
    return value instanceof Action ? value.getName() : "";
}
`;
const ACCEPTED_JSX = `import { ComboRow, DropDown, type DropDownProps } from "@gtkx/components";
export const choices = [
    <DropDown />,
    <ComboRow items={[{ id: "one", value: 1 }]} />,
    <DropDown items={[{ id: "one", value: { label: "One" } }]}
        renderItem={({ item }) => item.label} />,
];
export const forwarded = <T,>(props: DropDownProps<T>) => <DropDown {...props} />;
`;
const FORM_ACCEPTED = `import { ComboRow, EntryRow, SpinRow, SwitchRow, useForm } from "@gtkx/forms";
export function Form() {
    const { control } = useForm({ defaultValues: { name: "", count: 0, enabled: false, choice: "one" } });
    return <>
        <EntryRow {...{ control }} name="name" />
        <SpinRow {...{ control }} name="count" />
        <SwitchRow {...{ control }} name="enabled" />
        <ComboRow {...{ control }} name="choice"
            items={[{ id: "one", value: { label: "One" } }]}
            renderItem={({ item }) => item.label} />
    </>;
}
`;
const REJECTED = {
    "nullable-form-combo-row.tsx": `import { ComboRow, useForm } from "@gtkx/forms";
export function Form() {
    const { control } = useForm<{ choice: string | null }>({ defaultValues: { choice: null } });
    return <ComboRow {...{ control }} name="choice" items={[{ id: "one", value: "One" }]} />;
}
`,
    "optional-form-combo-row.tsx": `import { ComboRow, useForm } from "@gtkx/forms";
export function Form() {
    const { control } = useForm<{ choice?: string }>({ defaultValues: {} });
    return <ComboRow {...{ control }} name="choice" items={[{ id: "one", value: "One" }]} />;
}
`,
    "wrong-form-field.tsx": `import { EntryRow, useForm } from "@gtkx/forms";
export function Form() {
    const { control } = useForm({ defaultValues: { name: "" } });
    return <EntryRow {...{ control }} name="missing" />;
}
`,
    "wrong-form-value.tsx": `import { SpinRow, useForm } from "@gtkx/forms";
export function Form() {
    const { control } = useForm({ defaultValues: { count: "zero" } });
    return <SpinRow {...{ control }} name="count" />;
}
`,
    "interface-argument.ts": `import { Carousel } from "@gtkx/gi/adw";
new Carousel().setOrientation("vertical");
`,
    "overridden-return.ts": `import { SplitButton } from "@gtkx/gi/adw";
import type { TextDirection } from "@gtkx/gi/gtk";
export const direction: TextDirection = new SplitButton().getDirection();
`,
    "exclusive-props.ts": `import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
export const props: AdwToggleGroupProps = {active: 0, activeName: "first"};
`,
    "missing-shortcut-trigger-prop.ts": `import { GtkShortcutTrigger } from "@gtkx/jsx/gtk";
import { createElement } from "react";
createElement(GtkShortcutTrigger, {});
`,
    "missing-callback-action-prop.ts": `import { GtkCallbackAction } from "@gtkx/jsx/gtk";
import { createElement } from "react";
createElement(GtkCallbackAction, {});
`,
    "parsed-trigger-prop-on-keyval.ts": `import { GtkKeyvalTrigger } from "@gtkx/jsx/gtk";
import { createElement } from "react";
createElement(GtkKeyvalTrigger, { accelerator: "F5" });
`,
    "nullable-constructor-result.ts": `import { ShortcutTrigger } from "@gtkx/gi/gtk";
export const trigger: ShortcutTrigger = ShortcutTrigger.parseString("F5");
`,
    "nullable-dropdown-selection.ts": `import type { DropDownProps } from "@gtkx/components";
export const props: DropDownProps = { selectedId: null };
`,
    "nullable-combo-row-selection.ts": `import type { ComboRowProps } from "@gtkx/components";
export const props: ComboRowProps = { selectedId: null };
`,
    "mixed-collection-sources.ts": `import type { DropDownProps } from "@gtkx/components";
export const props: DropDownProps = { items: [], sections: [] };
`,
    "header-with-item-source.ts": `import type { ComboRowProps } from "@gtkx/components";
export const props: ComboRowProps = { items: [], renderHeader: () => null };
`,
    "header-without-section-source.ts": `import type { ListViewProps } from "@gtkx/components";
export const props: ListViewProps = { renderItem: () => null, renderHeader: () => null };
`,
    "structured-dropdown-without-renderer.ts": `import type { DropDownProps } from "@gtkx/components";
export const props: DropDownProps<{ label: string }> = { items: [{ id: "first", value: { label: "First" } }] };
`,
    "structured-combo-row-popup-only.ts": `import type { ComboRowProps } from "@gtkx/components";
export const props: ComboRowProps<{ label: string }> = {
    items: [{ id: "first", value: { label: "First" } }], renderListItem: ({ item }) => item.label,
};
`,
    "mixed-dropdown-without-renderer.ts": `import type { DropDownProps } from "@gtkx/components";
export const props: DropDownProps<string | { label: string }> = { items: [{ id: "first", value: { label: "First" } }] };
`,
    "inferred-structured-dropdown.tsx": `import { DropDown } from "@gtkx/components";
export const choice = <DropDown items={[{ id: "one", value: { label: "One" } }]} />;
`,
    "inferred-structured-combo-row.tsx": `import { ComboRow } from "@gtkx/components";
export const choice = <ComboRow sections={[{
    id: "group", value: "Group", data: [{ id: "one", value: { label: "One" } }],
}]} renderListItem={({ item }) => item.label} />;
`,
    "discarded-column-children.ts": `import type { ColumnViewProps } from "@gtkx/components";
export const props: ColumnViewProps = { columns: [], children: "unrendered" };
`,
};

const SIGNAL_ACCEPTED = `import * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";

class Beacon extends GObject.Object {}
const RegisteredBeacon = registerClass(Beacon, {
    typeName: "GtkxSignalHookTypeProbe",
    signals: { changed: { paramTypes: [GObject.TYPE_INT] } },
});
declare const beacon: InstanceType<typeof RegisteredBeacon>;
declare const editable: Gtk.Editable;
declare const button: Gtk.Button | null;

export function useDeclaredSignals(): void {
    useSignal(button, "clicked", () => {});
    useSignal(button, "notify::label", (value) => {
        const property: GObject.ParamSpec = value;
        property.getName();
    });
    useSignal(editable, "changed", () => {});
    useSignal(beacon, "changed", (value: number) => value);
}
`;
const SIGNAL_REJECTED = {
    "nondetailed-signal.ts": `import type * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
declare const button: Gtk.Button;
useSignal(button, "clicked::detail", () => {});
`,
    "unknown-signal.ts": `import type * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
declare const button: Gtk.Button;
useSignal(button, "not-real", () => {});
`,
    "wrong-signal-handler.ts": `import type * as Gtk from "@gtkx/gi/gtk";
import { useSignal } from "@gtkx/react";
declare const button: Gtk.Button;
useSignal(button, "notify::label", (value: string) => value);
`,
};

const copyPackage = (project: CliProject, name: string): void => {
    const source = join(WORKSPACE, "packages", name);
    const target = join(project.nodeModules, "@gtkx", name);
    rmSync(target);
    mkdirSync(target);
    cpSync(join(source, "package.json"), join(target, "package.json"));

    if (name === "native") {
        for (const file of ["main.d.ts", "index.d.ts", "internal.d.ts"]) {
            cpSync(join(source, file), join(target, file));
        }
    } else {
        cpSync(join(source, "dist"), join(target, "dist"), { recursive: true });
    }
};

const copyTypeDependencies = (project: CliProject): void => {
    rmSync(join(project.nodeModules, "@types"));
    rmSync(join(project.nodeModules, "csstype"));

    const reconcilerTypes = realpathSync(join(WORKSPACE, "packages/react/node_modules/@types/react-reconciler"));
    cpSync(reconcilerTypes, join(project.nodeModules, "@types/react-reconciler"), { recursive: true });
    const typeFest = realpathSync(join(WORKSPACE, "packages/utils/node_modules/type-fest"));
    cpSync(typeFest, join(project.nodeModules, "type-fest"), { recursive: true });
    const toolkit = realpathSync(join(WORKSPACE, "packages/utils/node_modules/es-toolkit"));
    cpSync(toolkit, join(project.nodeModules, "es-toolkit"), { recursive: true });
    const formPackage = realpathSync(join(WORKSPACE, "packages/forms/node_modules/react-hook-form"));
    cpSync(formPackage, join(project.nodeModules, "react-hook-form"), { recursive: true });
    const taggedTag = realpathSync(join(dirname(typeFest), "tagged-tag"));
    cpSync(taggedTag, join(project.nodeModules, "tagged-tag"), { recursive: true });

    for (const name of ["node", "react"]) {
        const source = realpathSync(join(WORKSPACE, "node_modules", "@types", name));
        cpSync(source, join(project.nodeModules, "@types", name), { recursive: true });
        const dependency = name === "node" ? "undici-types" : "csstype";
        const dependencyModules = dirname(dirname(source));
        const dependencySource = realpathSync(join(dependencyModules, dependency));
        cpSync(dependencySource, join(project.nodeModules, dependency), { recursive: true });
    }
};

const exportNamespaces = (project: CliProject): string => {
    const exports: string[] = [];

    for (const store of ["gi", "jsx"]) {
        const manifest = JSON.parse(
            readFileSync(join(project.nodeModules, "@gtkx", store, "package.json"), "utf8"),
        ) as { exports: Record<string, object | string> };
        const namespaces = Object.keys(manifest.exports).filter((key) => key !== "./package.json");

        for (const namespace of namespaces) {
            const name = namespace.slice(2);
            exports.push(`export * as ${store}_${name} from "@gtkx/${store}/${name}";`);
        }
    }

    return exports.join("\n");
};

const typecheck = (project: CliProject, file: string): void => {
    const result = spawnSync(process.execPath, [
        TYPESCRIPT_CLI,
        "--noEmit", "--module", "ESNext", "--moduleResolution", "Bundler", "--target", "ESNext",
        "--strict", "--exactOptionalPropertyTypes", "--noUncheckedIndexedAccess",
        "--skipLibCheck", "false", "--types", "node", "--jsx", "react-jsx", file,
    ], { cwd: project.root, encoding: "utf8" });

    if (result.status !== 0) {
        throw new Error(`${result.stdout}${result.stderr}`);
    }
};

describe("generated declarations in an installed consumer", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-installed-types-",
            config: `export default {applicationId: "org.gtkx.strict", libraries: ${JSON.stringify(STORE_LIBRARIES)}};`,
            files: {
                "accepted.ts": ACCEPTED,
                "accepted.tsx": ACCEPTED_JSX,
                "forms.tsx": FORM_ACCEPTED,
                "signal-accepted.ts": SIGNAL_ACCEPTED,
                ...REJECTED,
                ...SIGNAL_REJECTED,
            },
        });
        state.status = runCli(state.project, ["codegen"]).status;

        for (const name of PACKAGES) {
            copyPackage(state.project, name);
        }

        copyTypeDependencies(state.project);
        writeFileSync(join(state.project.root, "namespaces.ts"), exportNamespaces(state.project));
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(["namespaces.ts", "accepted.ts", "accepted.tsx", "forms.tsx", "signal-accepted.ts"])(
        "checks public API declarations in %s",
        (file) => {
            expect(state.status).toBe(0);
            typecheck(state.project, file);
        },
    );

    it.each([...Object.keys(REJECTED), ...Object.keys(SIGNAL_REJECTED)])(
        "rejects an incompatible consumer in %s",
        (file) => {
            expect(state.status).toBe(0);
            expect(() => {
                typecheck(state.project, file);
            }).toThrow();
        },
    );
});
