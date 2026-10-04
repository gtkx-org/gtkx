import { describe, expect, it } from "vitest";
import {
    createFactoryPropsProject,
    typecheckFactorySource,
} from "./codegen-factory-props-fixture.js";

describe("factory element contracts", () => {
    it("rejects invalid factory props and direct callback construction", () => {
        using project = createFactoryPropsProject();
        for (const source of [
            "export const action = new Gtk.CallbackAction();",
            "export const props: GtkCallbackActionProps = {};",
            "export const props: GtkShortcutTriggerProps = {};",
            'export const props: GtkCallbackActionProps = { callback: "invalid" };',
            "export const props: GtkShortcutTriggerProps = { accelerator: 1 };",
            "export const view = <GtkCallbackAction />;",
            "export const view = <GtkShortcutTrigger />;",
        ]) {
            expect(typecheckFactorySource(project, source)).not.toBe(0);
        }
    });
});
