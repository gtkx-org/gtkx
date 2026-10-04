import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";
import {
    installConfiguredProps,
    readButton,
    runDocs,
    stamp,
    writePropsConfig,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it.each(["utf8", "utf16le"] as const)("keeps unchanged %s BOM declarations cached", (encoding) => {
        using project = createCliProject({ prefix: "gtkx-props-bom-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        const declaration = join(project.nodeModules, "@audit/element-base/index.d.ts");
        writeFileSync(declaration, "\u{FEFF}" + readFileSync(declaration, "utf8"), encoding);
        runDocs(project);
        expect(readButton(project.root)).toContain("### `auditCaption`");
        const before = stamp(project.root);
        runDocs(project);
        expect(stamp(project.root)).toBe(before);
    });
});
