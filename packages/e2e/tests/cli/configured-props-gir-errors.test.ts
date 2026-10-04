import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    writePropsConfig,
} from "./configured-props-fixture.js";

const INVALID_DECLARATION = 'import type * as Gtk from "@gtkx/gi/gtk";\n' +
    "export interface AliasProps { auditWidget: Gtk.Absent; }\n";

describe("configured element prop reference", () => {
    it("rejects an absent GIR type without replacing prior pages", () => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-type-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "index.d.ts"), INVALID_DECLARATION);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });
});
