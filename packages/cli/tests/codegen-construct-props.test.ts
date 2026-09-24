import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.constructprops",
    libraries: ["Construct-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import * as Construct from "@gtkx/gi/construct";
import {
    GtkSignalAction, type GtkSignalActionProps,
    GtkNamedAction, type GtkNamedActionProps,
    GtkAlternativeTrigger, type GtkAlternativeTriggerProps,
    GtkKeyvalTrigger, GtkMnemonicTrigger, GtkNeverTrigger,
} from "@gtkx/jsx/gtk";
import {
    ConstructConfiguredAction, type ConstructConfiguredActionProps,
    ConstructInheritedAction, type ConstructInheritedActionProps,
} from "@gtkx/jsx/construct";
const trigger = Gtk.NeverTrigger.get();
`;
const typecheck = (project: CliProject, source: string): number | null => typecheckSource(project, IMPORTS + source);
const createProject = (): ReturnType<typeof createCliProject> => {
    const fixture = new URL("fixtures/gir/Construct-1.0.gir", import.meta.url);
    const project = createCliProject({
        prefix: "gtkx-construct-props-",
        config: CONFIG,
        files: { "gir/Construct-1.0.gir": readFileSync(fixture, "utf8") },
    });
    using pending = new DisposableStack();
    pending.use(project);
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);
    pending.move();

    return project;
};

describe("required construction props", () => {
    it("accepts supplied props in constructors, named types, component props, and JSX", () => {
        using project = createProject();
        expect(typecheck(project, `
            const signal: Gtk.SignalActionConstructorProps = { signalName: "activate" };
            const named: Gtk.NamedActionConstructorProps = { actionName: "app.save" };
            const alternative: Gtk.AlternativeTriggerConstructorProps = { first: trigger, second: trigger };
            export const instances = [
                new Gtk.SignalAction(signal), new Gtk.NamedAction(named), new Gtk.AlternativeTrigger(alternative),
            ];
            const signalProps: GtkSignalActionProps = signal;
            const namedProps: GtkNamedActionProps = named;
            const alternativeProps: GtkAlternativeTriggerProps = alternative;
            const signalComponent: ComponentProps<typeof GtkSignalAction> = signalProps;
            const namedComponent: ComponentProps<typeof GtkNamedAction> = namedProps;
            const alternativeComponent: ComponentProps<typeof GtkAlternativeTrigger> = alternativeProps;
            export const views = [
                <GtkSignalAction {...signalComponent} />, <GtkNamedAction {...namedComponent} />,
                <GtkAlternativeTrigger {...alternativeComponent} />,
            ];
            export const defaultInstances = [new Gtk.KeyvalTrigger(), new Gtk.MnemonicTrigger()];
            export const defaultViews = [<GtkKeyvalTrigger />, <GtkMnemonicTrigger />, <GtkNeverTrigger />];
        `)).toBe(0);
    });

    it("rejects omitted or nullable direct construction inputs", () => {
        using project = createProject();
        for (const expression of [
            "new Gtk.SignalAction()", "new Gtk.NamedAction()", "new Gtk.AlternativeTrigger()",
            "new Gtk.SignalAction({})", "new Gtk.NamedAction({})",
            "new Gtk.AlternativeTrigger({ first: trigger })", "new Gtk.AlternativeTrigger({ second: trigger })",
            "new Gtk.SignalAction({ signalName: null })", "new Gtk.SignalAction({ signalName: undefined })",
            "new Gtk.NamedAction({ actionName: null })", "new Gtk.NamedAction({ actionName: undefined })",
            "new Gtk.AlternativeTrigger({ first: null, second: trigger })",
            "new Gtk.AlternativeTrigger({ first: trigger, second: undefined })",
        ]) {
            expect(typecheck(project, `export const instance = ${expression};`)).not.toBe(0);
        }
    });

    it("requires the same inputs in named JSX props and rendered elements", () => {
        using project = createProject();
        for (const source of [
            "export const props: GtkSignalActionProps = {};",
            "export const props: GtkNamedActionProps = { actionName: null };",
            "export const props: GtkAlternativeTriggerProps = { first: trigger, second: undefined };",
            "export const view = <GtkSignalAction />;",
            "export const view = <GtkNamedAction />;",
            "export const view = <GtkAlternativeTrigger first={trigger} />;",
            "export const view = <GtkSignalAction signalName={undefined} />;",
            "export const view = <GtkNamedAction actionName={null} />;",
            "export const view = <GtkAlternativeTrigger first={null} second={trigger} />;",
        ]) {
            expect(typecheck(project, source)).not.toBe(0);
        }
    });

    it("preserves required inherited props when descendants add optional properties", () => {
        using project = createProject();
        expect(typecheck(project, `
            const configured: Construct.ConfiguredActionConstructorProps = { actionName: "app.save" };
            const inherited: Construct.InheritedActionConstructorProps = { actionName: "app.save", enabled: true };
            export const instances = [
                new Construct.ConfiguredAction(configured), new Construct.InheritedAction(inherited),
            ];
            const configuredProps: ConstructConfiguredActionProps = configured;
            const inheritedProps: ConstructInheritedActionProps = inherited;
            export const views = [
                <ConstructConfiguredAction {...configuredProps} />, <ConstructInheritedAction {...inheritedProps} />,
            ];
        `)).toBe(0);
        for (const source of [
            "export const instance = new Construct.ConfiguredAction();",
            "export const instance = new Construct.InheritedAction();",
            "export const instance = new Construct.ConfiguredAction({ enabled: true });",
            "export const instance = new Construct.InheritedAction({ actionName: null });",
            "export const props: ConstructConfiguredActionProps = { enabled: true };",
            "export const props: ConstructInheritedActionProps = { actionName: undefined };",
            "export const view = <ConstructConfiguredAction enabled />;",
            "export const view = <ConstructInheritedAction />;",
        ]) {
            expect(typecheck(project, source)).not.toBe(0);
        }
    });
});
