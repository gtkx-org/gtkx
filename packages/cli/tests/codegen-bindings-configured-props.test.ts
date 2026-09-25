import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { typecheckFile } from "./type-consumer.js";

const SHARED_IMPORT_CONFIG = `export default {
    applicationId: "org.gtkx.sharedimports",
    libraries: ["Gio-2.0"],
    elements: { config: {
        GObject: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GSimpleAction: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GBindingGroup: { props: { module: "react", export: "Attributes" } },
    } },
};`;
const NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: "group" };
`;
const SHARED_IMPORT_PROBE = `import type { GObjectProps } from "@gtkx/jsx/gobject";
import type { GSimpleActionProps } from "@gtkx/jsx/gio";
export const object: GObjectProps = {};
export const action: GSimpleActionProps = { name: "open" };
`;
const REJECTED_NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: {} };
`;
describe("gtkx codegen (configured props imports)", () => {
    let project: CliProject;
    let status: number | null;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-shared-imports-",
            config: SHARED_IMPORT_CONFIG,
            files: {
                "named.ts": NAMED_PROPS_PROBE,
                "shared.ts": SHARED_IMPORT_PROBE,
                "rejected.ts": REJECTED_NAMED_PROPS_PROBE,
            },
        });
        status = runCli(project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it.each([
        ["props imported by name from another package", "named.ts"],
        ["named props with runtime and type-only GI namespaces", "shared.ts"],
    ])("accepts %s", (_description, file) => {
        expect(status).toBe(0);
        expect(typecheckFile(project, file)).toBe(0);
    });

    it("rejects values incompatible with the imported props", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
    });
});
