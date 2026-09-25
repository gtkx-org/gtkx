import { describe, expect, it } from "vitest";
import { createConstructPropsProject, typecheckConstructProps } from "./codegen-construct-props-fixture.js";

describe("required construction props", () => {
    it("requires the same inputs in named JSX props and rendered elements", () => {
        using project = createConstructPropsProject();
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
            expect(typecheckConstructProps(project, source)).not.toBe(0);
        }
    });
});
