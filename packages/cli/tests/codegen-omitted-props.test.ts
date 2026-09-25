import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { OMITTED_PROPS_OUTPUT, omittedPropsConfig } from "./codegen-omitted-props-fixture.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

describe("configured GIR property omissions", () => {
    it("omits inherited properties and notify handlers without changing parent or interface consumers", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-inherited-",
            config: omittedPropsConfig({
                GtkToggleButton: { omittedProps: ["label"] },
                GtkEntry: { omittedProps: ["text"] },
                AdwApplicationWindow: { omittedProps: ["title"] },
            }),
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OMITTED_PROPS_OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkButton, GtkEntry, GtkSearchEntry, GtkToggleButton } from "@gtkx/jsx/gtk";\n' +
            'import { AdwApplicationWindow } from "@gtkx/jsx/adw";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkButton label="Parent" onNotifyLabel={() => undefined} />,
            <GtkToggleButton active />,
            <GtkEntry visibility />,
            <GtkSearchEntry text="Search" onNotifyText={() => undefined} />,
            <AdwApplicationWindow defaultWidth={400} />,
        ];`)).toBe(0);

        for (const view of [
            '<GtkToggleButton label="Omitted" />',
            "<GtkToggleButton onNotifyLabel={() => undefined} />",
            '<GtkEntry text="Omitted" />',
            "<GtkEntry onNotifyText={() => undefined} />",
            '<AdwApplicationWindow title="Omitted" />',
            "<AdwApplicationWindow onNotifyTitle={() => undefined} />",
        ]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const entry = readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/entry.md"), "utf8");
        const toggle = readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/toggle-button.md"), "utf8");
        expect(entry).not.toContain("### `text`");
        expect(entry).toContain("GIR props omitted from this element: `text`.");
        expect(toggle).toContain("GIR props omitted from this element: `label`.");
        expect(readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/button.md"), "utf8"))
            .toContain("### `label`");
        expect(readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/search-entry.md"), "utf8"))
            .toContain("### `text`");
    });
});
