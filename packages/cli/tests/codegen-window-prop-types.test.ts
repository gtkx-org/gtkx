import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.windowproptypes",' +
    " agents: { reference: true, rules: false } };";
const IMPORTS = `import type { ComponentProps } from "react";
import type * as Gtk from "@gtkx/gi/gtk";
import {
    GtkFrame, GtkLabel, GtkAdjustment, GtkScale, GtkMountOperation, GtkWindow,
    type GtkMountOperationProps, type GtkNativeDialogProps, type GtkWindowProps,
} from "@gtkx/jsx/gtk";
import { AdwApplication, AdwApplicationWindow, AdwWindow } from "@gtkx/jsx/adw";
`;
const ACCEPTED = IMPORTS + `
export const nativeProps = (windowInstance: Gtk.Window, appInstance: Gtk.Application) => {
    const windowValues: (Gtk.Window | null | undefined)[] = [windowInstance, null, undefined];
    const applicationValues: (Gtk.Application | null | undefined)[] = [appInstance, null, undefined];
    const mountProps = { parent: windowInstance };
    const windowProps = { transientFor: windowInstance, application: appInstance };
    return [
        ...windowValues.map((value) => ({ parent: value } satisfies GtkMountOperationProps)),
        ...windowValues.map((value) => ({ transientFor: value } satisfies GtkNativeDialogProps)),
        ...windowValues.map((value) => ({ transientFor: value } satisfies GtkWindowProps)),
        ...applicationValues.map((value) => ({ application: value } satisfies GtkWindowProps)),
        ...windowValues.map((value) => (
            { transientFor: value } satisfies ComponentProps<typeof AdwWindow>
        )),
        ...applicationValues.map((value) => (
            { application: value } satisfies ComponentProps<typeof AdwApplicationWindow>
        )),
        <GtkMountOperation {...mountProps} />,
        <GtkWindow {...windowProps} />,
        <AdwWindow {...windowProps} />,
        <AdwApplicationWindow {...windowProps} />,
    ];
};
export const standalone = <AdwApplication applicationId="org.gtkx.windowproptypes.consumer">
    <AdwApplicationWindow><GtkLabel label="Main window" /></AdwApplicationWindow>
    <AdwWindow><GtkLabel label="Independent window" /></AdwWindow>
</AdwApplication>;
export const objectProperties = [
    <GtkFrame labelWidget={<GtkLabel label="Frame title" />} />,
    <GtkScale adjustment={<GtkAdjustment lower={0} upper={100} />} />,
];
`;
const REJECTED: Record<string, string> = {
    "mount-parent.tsx": "export const props = { parent: <AdwWindow /> } satisfies GtkMountOperationProps;",
    "dialog-parent.tsx": "export const props = { transientFor: <AdwWindow /> } satisfies GtkNativeDialogProps;",
    "window-parent.tsx": "export const props = { transientFor: <AdwWindow /> } satisfies GtkWindowProps;",
    "window-application.tsx": "export const props = { application: <AdwApplication /> } satisfies GtkWindowProps;",
    "inherited-parent.tsx": "export const props = { transientFor: <AdwWindow /> }" +
        " satisfies ComponentProps<typeof AdwWindow>;",
    "inherited-application.tsx": "export const props = { application: <AdwApplication /> }" +
        " satisfies ComponentProps<typeof AdwApplicationWindow>;",
    "rendered-parent.tsx": "export const view = <AdwWindow transientFor={<AdwWindow />} />;",
};

describe("generated window and application property types", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const rejectedFiles = Object.fromEntries(
            Object.entries(REJECTED).map(([name, source]) => [name, IMPORTS + source]),
        );
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-window-props-",
            config: CONFIG,
            hasAgentReference: true,
            files: {
                "accepted.tsx": ACCEPTED,
                ...rejectedFiles,
            },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts native parents, nullish values, standalone windows and inline object properties", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects a portaled property element in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents native window properties while retaining inline widget elements", () => {
        for (const [file, name, expected] of [
            ["mount-operation", "parent", "Gtk.Window"],
            ["native-dialog", "transientFor", "Gtk.Window"],
            ["window", "transientFor", "Gtk.Window"],
            ["window", "application", "Gtk.Application"],
        ] as const) {
            const markdown = readFileSync(join(project.root, `.gtkx/reference/gtk/${file}.md`), "utf8");
            const heading = `### \`${name}\``;
            expect(markdown).toContain(heading);
            const property = markdown.split(heading)[1]?.split("\n### ", 1)[0];
            expect(property).toContain(expected);
            expect(property).not.toContain("ReactElement");
        }
        const frame = readFileSync(join(project.root, ".gtkx/reference/gtk/frame.md"), "utf8");
        expect(frame).toContain("### `labelWidget`\n\n`Gtk.Widget | ReactElement`");
    });
});
