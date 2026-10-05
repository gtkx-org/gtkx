import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";
import {
    BASE_DECLARATION,
    installConfiguredProps,
    readButton,
    runDocs,
    stamp,
    writePropsConfig,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it("invalidates cached pages when a transitive declaration changes", () => {
        using project = createCliProject({ prefix: "gtkx-props-freshness-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
        writeFileSync(join(project.nodeModules, "@audit/element-base/index.d.ts"), BASE_DECLARATION);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditReplacement`");
        expect(readButton(project.root)).not.toContain("### `auditCaption`");
    });
});
