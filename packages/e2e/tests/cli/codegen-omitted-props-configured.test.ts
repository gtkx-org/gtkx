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

describe("configured GIR property omissions for configured props", () => {
    it("omits inherited configured property entries without changing other consumers", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-interface-props-",
            config: omittedPropsConfig({
                GtkEditable: { props: { module: OMITTED_PROPS_MODULE, export: "EditableExtras" } },
                GtkEntry: { omittedProps: ["text"] },
            }),
            files: omittedPropsFixtureFiles,
        });
        runCliOrThrow(project, ["codegen"]);
        runCliOrThrow(project, ["docs", "--out", OMITTED_PROPS_OUTPUT]);
        isolateTypeConsumer(project);
        const imports = 'import { GtkEntry, GtkSearchEntry } from "@gtkx/jsx/gtk";\n';
        expect(typecheckSource(project, imports + `export const views = [
            <GtkEntry extra visibility />,
            <GtkSearchEntry text="Search" onNotifyText={() => undefined} extra />,
        ];`)).toBe(0);
        for (const view of ['<GtkEntry text="Omitted" />', "<GtkEntry onNotifyText={() => undefined} />"]) {
            expect(typecheckSource(project, imports + `export const view = ${view};`)).not.toBe(0);
        }

        const entry = readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/entry.md"), "utf8");
        const search = readFileSync(join(project.root, OMITTED_PROPS_OUTPUT, "gtk/search-entry.md"), "utf8");
        for (const name of ["text", "onNotifyText"]) {
            expect(entry).not.toContain("### `" + name + "`");
            expect(search).toContain("### `" + name + "`");
        }
        expect(entry).toContain("### `extra`");
    });
});
