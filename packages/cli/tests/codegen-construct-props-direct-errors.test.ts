import { describe, expect, it } from "vitest";
import { createConstructPropsProject, typecheckConstructProps } from "./codegen-construct-props-fixture.js";

describe("required construction props", () => {
    it("rejects omitted or nullable direct construction inputs", () => {
        using project = createConstructPropsProject();
        for (const expression of [
            "new Gtk.SignalAction()", "new Gtk.NamedAction()", "new Gtk.AlternativeTrigger()",
            "new Gtk.SignalAction({})", "new Gtk.NamedAction({})",
            "new Gtk.AlternativeTrigger({ first: trigger })", "new Gtk.AlternativeTrigger({ second: trigger })",
            "new Gtk.SignalAction({ signalName: null })", "new Gtk.SignalAction({ signalName: undefined })",
            "new Gtk.NamedAction({ actionName: null })", "new Gtk.NamedAction({ actionName: undefined })",
            "new Gtk.AlternativeTrigger({ first: null, second: trigger })",
            "new Gtk.AlternativeTrigger({ first: trigger, second: undefined })",
        ]) {
            expect(typecheckConstructProps(project, `export const instance = ${expression};`)).not.toBe(0);
        }
    });
});
