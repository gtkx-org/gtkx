import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import { config, docsDir, DOCUMENTED_PAGE, FIXTURE_GIR, readPage, runDocs } from "./docs-fixture.js";

const ASYNC_SACK_PAGE = "asyncpair/sack.md";
const ASYNC_JOB_PAGE = "asyncpair/job.md";
const REJECTED_OUT_DIRS = ["", ".", "..", "../sibling", "docs/../..", "/elsewhere/docs"];
const PACKAGEKIT_SEARCH_TEXT = 'free text to search for, for instance, "power"';

describe("gtkx docs (directories it refuses to write to)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "", tmpDir: "" } };

    beforeAll(() => {
        state.project = createCliProject({ prefix: "gtkx-cli-docs-out-", config: config(), hasStore: true });
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(REJECTED_OUT_DIRS)("fails over an out directory of %j", (out) => {
        expect(runCli(state.project, ["docs", "--out", out]).status).not.toBe(0);
        expect(existsSync(join(state.project.root, "docs"))).toBe(false);
    });
});

describe("gtkx docs (ordinary prose that starts with free)", () => {
    it("preserves the PackageKit search parameter description and strips C memory management", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-docs-free-text-",
            config: config(', girPath: ["./gir"]', ["Documented-1.0"]),
            files: { "gir/Documented-1.0.gir": readFileSync(join(FIXTURE_GIR, "Documented-1.0.gir")) },
        });

        expect(runDocs(project)).toBe(0);
        const page = readPage(project, DOCUMENTED_PAGE);
        expect(page).toContain(PACKAGEKIT_SEARCH_TEXT);
        expect(page).toContain("Copies the note text.");
        expect(page).toContain("**Returns** a copy of the note.");
        expect(page).toContain("**Returns** a list of strvs.");
        expect(page).toContain("- `buffer`: the buffer to copy into");
        expect(page).toContain("Describes copied values.");
        expect(page).toContain("The memory of the input has to be dynamically allocated.");
        expect(page).toContain("Describes allocator behavior.");
        expect(page).toContain("automatically via `g_free()`");
        expect(page).toContain("using `g_realloc()` and `g_free()` for memory allocation");
        expect(page).toContain("Describes lifecycle details.");
        expect(page).toContain("Note that filters run in another thread.");
        expect(page).toContain("The port is chosen by the system.");
        expect(page).toContain("After calling this function, it is no longer possible to add more nodes.");
        expect(page).toContain("The items are not freed.");
        expect(page).toContain("The data contained in the resulting `GBytes` is always zero-terminated.");
        expect(page).toContain("rather than handed to `g_free()`");
        expect(page).toContain(
            "Since you are providing a pre-allocated note buffer, you must also specify a way to free that data.",
        );
        expect(page).toContain("your destroy notification function will be called");
        expect(page).toContain("**Returns** a list of cell renderers.");
        expect(page).toContain("Describes clause details.");
        expect(page).toContain("Returns the label of the note, if any.");
        expect(page).toContain("Reads the tooltip back, when set.");
        expect(page).toContain("Gets the icon of the note, if one was set.");
        expect(page).toContain("The buffer is reused.");
        expect(page).toContain("If the note holds a string, the location will contain a newly allocated string.");
        expect(page).toContain("Reading a joined note returns a handle only if joining was requested.");
        expect(page).toContain("On failure, the caller must close the descriptor themselves.");
        expect(page).toContain("final releases of code");
        expect(page).toContain("so code must not depend on any side effects from reading them.");
        expect(page).toContain("To delete a note window, call `Gtk.Window.destroy()`.");
        expect(page).toContain("You must use `GLib.Source.destroy()` for sources added to a non-default main context.");
        expect(page).toContain("- `label`: the label text");
        expect(page).toContain("**Returns** a newly created window.");
        expect(page).not.toContain("but if the note");
        expect(page).not.toContain("Likewise");
        expect(page).not.toContain("In that case");
        expect(page).not.toContain("On success");
        expect(page).not.toContain("takes ownership");
        expect(page).not.toContain("take ownership");
        expect(page).not.toContain("ref and sink");
        expect(page).not.toContain("objects are referenced");
        expect(page).not.toContain("documented_label_new");
        expect(page).not.toContain("Instead");
        expect(page).not.toContain("In particular");
        expect(page).not.toContain("This address");
        expect(page).not.toContain("The only function");
        expect(page).not.toContain("dynamically allocated,");
        expect(page).not.toContain("no longer in use");
        expect(page).not.toContain("belongs to the caller");
        expect(page).not.toContain("The list");
        expect(page).not.toContain("must free");
        expect(page).not.toContain("must be freed");
        expect(page).not.toContain("should be freed");
        expect(page).not.toContain("needs to be freed");
        expect(page).not.toContain("eventually be freed");
        expect(page).not.toContain("responsible for freeing");
        expect(page).not.toContain("Free it with");
        expect(page).not.toContain("Free each item");
        expect(page).not.toContain("strfreev");
    });
});

describe("gtkx docs (async finish pairing)", () => {
    it("documents the paired generic finish and the remaining callback-only methods", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-docs-async-pair-",
            config: config(', girPath: ["./gir"]', ["AsyncPair-1.0"]),
            files: { "gir/AsyncPair-1.0.gir": readFileSync(join(FIXTURE_GIR, "AsyncPair-1.0.gir")) },
        });

        expect(runDocs(project)).toBe(0);
        expect(readPage(project, ASYNC_SACK_PAGE)).toContain(
            "fetchAsync(cancellable?: NativeInstance<Gio.Cancellable> | null): Promise<boolean>",
        );
        expect(readPage(project, ASYNC_SACK_PAGE)).not.toContain("Callback-based:");
        expect(readPage(project, ASYNC_JOB_PAGE)).toContain(
            "externalAsync(callback: Gio.AsyncReadyCallback | null): void",
        );
        expect(readPage(project, ASYNC_JOB_PAGE)).toContain(
            "Callback-based: the GIR declares `AsyncPair.Client.genericFinish` as its finish function",
        );
    });
});

describe("gtkx docs (a project with nothing to document)", () => {
    it("fails when the project generates no bindings", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-docs-disabled-",
            config: config(", codegen: false"),
            hasStore: true,
        });

        expect(runDocs(project)).not.toBe(0);
        expect(existsSync(docsDir(project))).toBe(false);
    });
});
