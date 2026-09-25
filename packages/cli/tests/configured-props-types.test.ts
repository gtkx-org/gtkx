import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    installConfiguredProps,
    readButton,
    runDocs,
    typecheckConsumer,
    writePropsConfig,
} from "./configured-props-fixture.js";

describe("configured element prop reference", () => {
    it("documents installed interfaces, inherited generics, utility types, and GIR types before codegen", () => {
        using project = createCliProject({ prefix: "gtkx-configured-props-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root, "ButtonProps");
        runDocs(project);
        const interfacePage = readButton(project.root);
        expect(interfacePage).toContain("### `auditCaption`");
        expect(interfacePage).toContain("### `auditCount`");
        expect(interfacePage).toContain("Gtk.Widget | null");
        writePropsConfig(project.root);
        runDocs(project);
        const aliasPage = readButton(project.root);
        expect(aliasPage).toContain("### `auditCaption`");
        expect(aliasPage).toContain("### `auditMode`");
        expect(aliasPage).toContain("audit-${string}");
        expect(aliasPage).not.toContain("### `auditCount`");
        runCliOrThrow(project, ["codegen"]);
        expect(readButton(project.root, ".gtkx/reference")).toContain("### `auditCaption`");
        expect(readButton(project.root, ".gtkx/reference")).not.toContain("### `auditCount`");
        typecheckConsumer(project);
    });
});
