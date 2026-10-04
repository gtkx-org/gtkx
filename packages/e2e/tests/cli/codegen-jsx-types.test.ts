import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const COMPILER_OPTIONS = ["--skipLibCheck", "true"];
const CONFIG = 'export default { applicationId: "org.gtkx.jsxcontracts" };\n';
const ACCEPTED = `import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
import type { GtkLabelProps } from "./node_modules/.gtkx/jsx/gtk/gtk.js";

declare module "./node_modules/.gtkx/jsx/gtk/gtk.js" {
    interface GtkLabelProps { consumer?: string }
}

export const selections: AdwToggleGroupProps[] = [{}, { active: 0 }, { activeName: "first" }];
export const notify: AdwToggleGroupProps = {
    active: 0,
    onNotifyActive: (value) => value,
    onNotifyActiveName: (value) => value,
};
export const augmented: GtkLabelProps = { consumer: "value", label: "Label" };
`;
const REJECTED = `import type { AdwToggleGroupProps } from "@gtkx/jsx/adw";
export const selection: AdwToggleGroupProps = { active: 0, activeName: "first" };
`;
const UNION_CONSUMER = `import type { GtkLabelProps } from "@gtkx/jsx/gtk";
import { omit } from "@gtkx/utils";

type LabelProps = { onSelect: () => void } & (
    { kind: "text"; text: string } | { kind: "count"; count: number }
);
export const labelProps = (props: LabelProps): GtkLabelProps => {
    const value = omit(props, ["onSelect"]);
    return { label: value.kind === "text" ? value.text : String(value.count) };
};
export const label = labelProps({ kind: "text", text: "One", onSelect: () => undefined });
export const count = labelProps({ kind: "count", count: 1, onSelect: () => undefined });
`;
const REJECTED_UNION_CONSUMER = `${UNION_CONSUMER}
export const invalid = (props: LabelProps) => omit(props, ["onSelect"]).onSelect();
`;

describe("gtkx codegen JSX prop contracts", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-jsx-types-",
            config: CONFIG,
            files: {
                "accepted.ts": ACCEPTED,
                "rejected.ts": REJECTED,
                "union-consumer.ts": UNION_CONSUMER,
                "rejected-union-consumer.ts": REJECTED_UNION_CONSUMER,
            },
        });
        state.status = runCli(state.project, ["codegen"]).status;
        isolateTypeConsumer(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("accepts each selection form and preserves interface augmentation", () => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, "accepted.ts", COMPILER_OPTIONS)).toBe(0);
    });

    it("rejects naming and indexing the same controlled selection together", () => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, "rejected.ts", COMPILER_OPTIONS)).not.toBe(0);
    });

    it("preserves discriminated consumer props when extracting widget props", () => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, "union-consumer.ts", COMPILER_OPTIONS)).toBe(0);
        expect(typecheckFile(state.project, "rejected-union-consumer.ts", COMPILER_OPTIONS)).not.toBe(0);
    });
});
