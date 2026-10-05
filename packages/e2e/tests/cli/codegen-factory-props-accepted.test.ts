import { describe, expect, it } from "vitest";
import {
    createFactoryPropsProject,
    typecheckFactorySource,
} from "./codegen-factory-props-fixture.js";

describe("factory element contracts", () => {
    it("accepts the same props through named types, component props, and JSX", () => {
        using project = createFactoryPropsProject();
        expect(typecheckFactorySource(project, `
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
});
