import { describe, expect, it } from "vitest";
import {
    createFactoryPropsProject,
    typecheckFactorySource,
} from "./codegen-factory-props-fixture.js";

describe("factory element contracts", () => {
    it("keeps factory-only arguments out of concrete trigger subclasses", () => {
        using project = createFactoryPropsProject();
        expect(typecheckFactorySource(project, `
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
            expect(typecheckFactorySource(project, source)).not.toBe(0);
        }
    });
});
