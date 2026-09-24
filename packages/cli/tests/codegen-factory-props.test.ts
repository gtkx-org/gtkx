import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.factoryprops",
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkCallbackAction, type GtkCallbackActionProps,
    GtkShortcutTrigger, type GtkShortcutTriggerProps,
    GtkKeyvalTrigger, type GtkKeyvalTriggerProps,
    GtkNeverTrigger, type GtkNeverTriggerProps,
} from "@gtkx/jsx/gtk";
`;
const typecheck = (project: CliProject, source: string): number | null => typecheckSource(project, IMPORTS + source);
const createProject = (): ReturnType<typeof createCliProject> => {
    const project = createCliProject({ prefix: "gtkx-factory-props-", config: CONFIG });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

describe("factory element contracts", () => {
    it("accepts the same props through named types, component props, and JSX", () => {
        using project = createProject();
        expect(typecheck(project, `
            export const callback: GtkCallbackActionProps = { callback: () => true };
            export const action: Gtk.CallbackAction = Gtk.CallbackAction.new(callback.callback);
            export const trigger: GtkShortcutTriggerProps = { accelerator: "<Control>a" };
            export const callbackComponent: ComponentProps<typeof GtkCallbackAction> = callback;
            export const triggerComponent: ComponentProps<typeof GtkShortcutTrigger> = trigger;
            export const callbackNamed: GtkCallbackActionProps = callbackComponent;
            export const triggerNamed: GtkShortcutTriggerProps = triggerComponent;
            export const typedRef: GtkShortcutTriggerProps<Gtk.KeyvalTrigger> = {
                accelerator: "<Control>b",
                ref: (value) => { value?.getKeyval(); },
            };
            export const views = [<GtkCallbackAction {...callback} />, <GtkShortcutTrigger {...trigger} />];
        `)).toBe(0);
    });

    it("rejects invalid factory props and direct callback construction", () => {
        using project = createProject();
        for (const source of [
            "export const action = new Gtk.CallbackAction();",
            "export const props: GtkCallbackActionProps = {};",
            "export const props: GtkShortcutTriggerProps = {};",
            'export const props: GtkCallbackActionProps = { callback: "invalid" };',
            "export const props: GtkShortcutTriggerProps = { accelerator: 1 };",
            "export const view = <GtkCallbackAction />;",
            "export const view = <GtkShortcutTrigger />;",
        ]) {
            expect(typecheck(project, source)).not.toBe(0);
        }
    });

    it("keeps factory-only arguments out of concrete trigger subclasses", () => {
        using project = createProject();
        expect(typecheck(project, `
            export const keyval: GtkKeyvalTriggerProps = { keyval: 65, modifiers: 0 };
            export const never: GtkNeverTriggerProps = {};
            export const keyvalComponent: ComponentProps<typeof GtkKeyvalTrigger> = keyval;
            export const neverComponent: ComponentProps<typeof GtkNeverTrigger> = never;
            export const views = [<GtkKeyvalTrigger {...keyval} />, <GtkNeverTrigger {...never} />];
        `)).toBe(0);
        for (const source of [
            'export const props: GtkKeyvalTriggerProps = { accelerator: "a" };',
            'export const props: GtkNeverTriggerProps = { accelerator: "a" };',
            'export const view = <GtkKeyvalTrigger accelerator="a" />;',
            'export const view = <GtkNeverTrigger accelerator="a" />;',
        ]) {
            expect(typecheck(project, source)).not.toBe(0);
        }
    });
});
