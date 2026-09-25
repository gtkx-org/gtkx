import { describe, expect, it } from "vitest";
import { createConstructPropsProject, typecheckConstructProps } from "./codegen-construct-props-fixture.js";

describe("required construction props", () => {
    it("accepts supplied props in constructors, named types, component props, and JSX", () => {
        using project = createConstructPropsProject();
        expect(typecheckConstructProps(project, `
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

    it("preserves required inherited props when descendants add optional properties", () => {
        using project = createConstructPropsProject();
        expect(typecheckConstructProps(project, `
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
            expect(typecheckConstructProps(project, source)).not.toBe(0);
        }
    });
});
