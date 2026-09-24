import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = 'export default { applicationId: "org.gtkx.settingstree", libraries: ["Gio-2.0"],' +
    " agents: { reference: false, rules: false } };";
const IMPORTS = 'import * as Gio from "@gtkx/gi/gio";\nimport * as GLib from "@gtkx/gi/glib";\n';
const ACCEPTED = IMPORTS + `export const empty: ReturnType<typeof Gio.SettingsBackend.flattenTree> = [null, [], []];
export const path = (tree: GLib.Tree): string | null => Gio.SettingsBackend.flattenTree(tree)[0];
export const populated = (value: GLib.Variant): ReturnType<typeof Gio.SettingsBackend.flattenTree> =>
    ["/org/gtkx/", ["key"], [value]];
`;
const CONTROL = IMPORTS + `export const entries = (tree: GLib.Tree): [string[], GLib.Variant[]] => {
    const [, keys, values] = Gio.SettingsBackend.flattenTree(tree);
    return [keys, values];
};
`;
const REJECTED = IMPORTS + `export const path = (tree: GLib.Tree): string =>
    Gio.SettingsBackend.flattenTree(tree)[0];
`;

describe("generated settings tree nullable paths", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-settings-tree-",
            config: CONFIG,
            files: { "accepted.ts": ACCEPTED, "control.ts": CONTROL, "nonnull.ts": REJECTED },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts empty and populated tree result contracts", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it("preserves non-null key and value arrays", () => {
        expect(typecheckFile(project, "control.ts")).toBe(0);
    });

    it("rejects an unconditional non-null path reader", () => {
        expect(typecheckFile(project, "nonnull.ts")).not.toBe(0);
    });

    it("documents the nullable path without widening arrays", () => {
        const reference = loadApiReference({
            libraries: ["Gio-2.0"],
            girPath: resolveGirPath(undefined, project.root),
            resolveFrom: project.root,
        });
        const page = reference.lookup("Gio.SettingsBackend", "class");
        expect(page.outcome).toBe("page");
        expect(page).toHaveProperty("markdown", expect.stringContaining(
            "flattenTree(tree: GLib.Tree): [string | null, string[], GLib.Variant[]]",
        ));
    });
});
