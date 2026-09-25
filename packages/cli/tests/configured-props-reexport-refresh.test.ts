import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";
import {
    installConfiguredProps,
    PROPS_MODULE,
    readButton,
    runDocs,
    writePropsConfig,
} from "./configured-props-fixture.js";

const REEXPORT_DECLARATION = "export interface ReexportedProps { auditEarlier?: Date; }\n";

describe("configured element prop reference", () => {
    it("follows reexports when an earlier declaration source appears", () => {
        using project = createCliProject({ prefix: "gtkx-props-reexport-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "ReexportedProps");
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReexported`");
        writeFileSync(join(project.nodeModules, PROPS_MODULE, "reexport.ts"), REEXPORT_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditEarlier`");
        expect(readButton(project.root)).not.toContain("### `auditReexported`");
    });
});
