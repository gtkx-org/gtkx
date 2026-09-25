import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    OMITTED_PROPS_MODULE,
    OMITTED_PROPS_OUTPUT,
    omittedPropsConfig,
    omittedPropsFixtureFiles,
} from "./codegen-omitted-props-fixture.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

describe("configured GIR property omission replacements", () => {
    it("preserves configured replacement props and inherited discriminated branches", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-replacement-",
            config: omittedPropsConfig({
                GtkButton: { props: { module: OMITTED_PROPS_MODULE, export: "BranchProps" } },
                GtkToggleButton: {
                    omittedProps: ["label"],
                    props: { module: OMITTED_PROPS_MODULE, export: "ReplacementProps" },
                },
            }),
            files: omittedPropsFixtureFiles,
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OMITTED_PROPS_OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkButton, GtkToggleButton } from "@gtkx/jsx/gtk";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkButton label="Parent" kind="text" text="Text" />,
            <GtkToggleButton label={3} onNotifyLabel={(value) => value.toFixed()} kind="text" text="Text" />,
            <GtkToggleButton label={4} kind="count" count={1} />,
        ];`)).toBe(0);

        for (const view of [
            '<GtkToggleButton label="Omitted" kind="text" text="Text" />',
            '<GtkToggleButton kind="text" count={1} />',
            '<GtkToggleButton kind="count" />',
        ]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const page = readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/toggle-button.md"), "utf8");
        expect(page).toContain("### `label`\n\n`number`");
        expect(page).toContain("### `onNotifyLabel`");
    });
});
