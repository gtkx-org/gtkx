import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.nullablecallbacks",
    libraries: ["NullableCallbacks-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as Gtk from "@gtkx/gi/gtk";
import * as GLib from "@gtkx/gi/glib";
import * as NullableCallbacks from "@gtkx/gi/nullablecallbacks";
`;
const ACCEPTED = IMPORTS + `
export const cancelled: Parameters<Gtk.PageSetupDoneFunc> = [null];
export const selected = (setup: Gtk.PageSetup): Parameters<Gtk.PageSetupDoneFunc> => [setup];
export const completed: Gtk.PageSetupDoneFunc = (setup) => {
    if (setup !== null) {
        setup.getOrientation();
    }
};
export const present = (settings: Gtk.PrintSettings): void => {
    Gtk.printRunPageSetupDialogAsync(null, null, settings, completed);
};
export const alias: Parameters<NullableCallbacks.PageSetupAlias> = [null];
export const unrelated = (setup: Gtk.PageSetup): Parameters<NullableCallbacks.PageSetupDoneFunc> => [setup];
export const annotated: Parameters<NullableCallbacks.NullableSetup> = [null];
export const exhausted: ReturnType<GLib.Dir["readName"]> = null;
export const existingCorrections = (layout: Gtk.FixedLayoutChild, directory: GLib.Dir): string | null => {
    layout.setTransform(null);
    return directory.readName();
};
`;
const REJECTED: Record<string, string> = {
    "nonnull-handler.ts": "export const callback: Gtk.PageSetupDoneFunc = (setup: Gtk.PageSetup) => " +
        "{ setup.getOrientation(); };",
    "nonnull-async-handler.ts": "export const present = (settings: Gtk.PrintSettings): void => " +
        "{ Gtk.printRunPageSetupDialogAsync(null, null, settings, (setup: Gtk.PageSetup) => " +
        "{ setup.getOrientation(); }); };",
    "extra-user-data.ts": "export const args: Parameters<Gtk.PageSetupDoneFunc> = [null, null];",
    "missing-result.ts": "export const args: Parameters<Gtk.PageSetupDoneFunc> = [];",
    "unrelated-null-result.ts": "export const args: Parameters<NullableCallbacks.PageSetupDoneFunc> = [null];",
};
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([file, source]) => [file, IMPORTS + source]));

describe("generated page setup completion nullability", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/NullableCallbacks-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-page-setup-nullable-",
            config: CONFIG,
            files: { "gir/NullableCallbacks-1.0.gir": fixture, "accepted.ts": ACCEPTED, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("accepts nullable completions and preserves unrelated callback and function contracts", () => {
        expect(typecheckFile(project, "accepted.ts")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the unsupported callback consumer in %s", (file) => {
        expect(typecheckFile(project, file)).not.toBe(0);
    });

    it("documents corrected and declared callback nullability", () => {
        const reference = loadApiReference({
            libraries: ["Gtk-4.0", "NullableCallbacks-1.0"],
            girPath: resolveGirPath(["./gir"], project.root),
            resolveFrom: project.root,
        });
        const corrected = reference.lookup("Gtk.PageSetupDoneFunc", "callback");
        expect(corrected.outcome).toBe("page");
        expect(corrected).toHaveProperty("markdown", expect.stringContaining(
            "type PageSetupDoneFunc = (pageSetup: Gtk.PageSetup | null) => void",
        ));
        const unrelated = reference.lookup("NullableCallbacks.PageSetupDoneFunc", "callback");
        expect(unrelated.outcome).toBe("page");
        expect(unrelated).toHaveProperty("markdown", expect.stringContaining(
            "type PageSetupDoneFunc = (pageSetup: Gtk.PageSetup) => void",
        ));
        const annotated = reference.lookup("NullableCallbacks.NullableSetup", "callback");
        expect(annotated.outcome).toBe("page");
        expect(annotated).toHaveProperty("markdown", expect.stringContaining(
            "type NullableSetup = (pageSetup: Gtk.PageSetup | null) => void",
        ));
    });
});
