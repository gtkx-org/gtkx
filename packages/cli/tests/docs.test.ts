import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    STORE_LIBRARIES,
} from "./cli-project.js";

const APPLICATION_ID = "com.gtkx.clidocs";
const OUT_DIR = join("site", "elements");
const BASE_PATH = "/elements";
const INDEX_PAGE = "index.md";
const MANIFEST = "manifest.json";
const NAMESPACE_PREFIX = "gtk/";
const ELEMENT_PAGE = `${NAMESPACE_PREFIX}button.md`;
const COLLIDING_PROPERTY_PAGE = `${NAMESPACE_PREFIX}map-list-model.md`;
const NAMESPACE_INDEX = `${NAMESPACE_PREFIX}index.md`;
const STATIC_ELEMENT_PAGE = "giounix/desktop-app-info.md";
const OWNERSHIP_PAGE = "soup/message.md";
const AUTH_PAGE = "soup/auth.md";
const SOCKET_LISTENER_PAGE = "gio/socket-listener.md";
const RESOLVER_PAGE = "gio/resolver.md";
const COOKIE_JAR_PAGE = "soup/cookie-jar.md";
const SOCKET_PAGE = "gio/socket.md";
const PANGO_LAYOUT_PAGE = "pango/layout.md";
const GOBJECT_PAGE = "gobject/object.md";
const ICON_VIEW_PAGE = "gtk/icon-view.md";
const TREE_SELECTION_PAGE = "gtk/tree-selection.md";
const DBUS_INVOCATION_PAGE = "gio/d-bus-method-invocation.md";
const FILE_ENUMERATOR_PAGE = "gio/file-enumerator.md";
const WINDOW_PAGE = "gtk/window.md";
const DBUS_CONNECTION_PAGE = "gio/d-bus-connection.md";
const PIXBUF_PAGE = "gdkpixbuf/pixbuf.md";
const SIDEBAR_PAGE = "adw/sidebar.md";
const APPLICATION_PAGE = "adw/application.md";
const DOCUMENTED_PAGE = "documented/note.md";
const ASYNC_SACK_PAGE = "asyncpair/sack.md";
const ASYNC_JOB_PAGE = "asyncpair/job.md";
const REFERENCE_LIBRARIES = [...STORE_LIBRARIES, "GioUnix-2.0"];
const REJECTED_OUT_DIRS = ["", ".", "..", "../sibling", "docs/../..", "/elsewhere/docs"];
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));
const PACKAGEKIT_SEARCH_TEXT = 'free text to search for, for instance, "power"';

const config = (body = "", libraries = STORE_LIBRARIES): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(libraries)}` +
    `${body} };\n`;

const docsDir = (project: CliProject): string => join(project.root, OUT_DIR);

const runDocs = (project: CliProject, args: string[] = []): number | null =>
    runCli(project, ["docs", "--out", OUT_DIR, "--base-path", BASE_PATH, ...args]).status;

const indexStamp = (project: CliProject): number => statSync(join(docsDir(project), INDEX_PAGE)).mtimeMs;
const readPage = (project: CliProject, name: string): string => readFileSync(join(docsDir(project), name), "utf8");

describe("gtkx docs", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-docs-",
            config: config("", REFERENCE_LIBRARIES),
            hasStore: true,
        });
        state.status = runDocs(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("writes an element page per namespace under the requested directory", () => {
        const written = readdirSync(docsDir(state.project), { recursive: true, encoding: "utf8" });
        const index = readPage(state.project, INDEX_PAGE);
        expect(state.status).toBe(0);
        expect(written).toContain(INDEX_PAGE);
        expect(written).toContain(MANIFEST);
        expect(written).toContain(NAMESPACE_INDEX);
        expect(written).toContain(ELEMENT_PAGE);
        expect(written).toContain(COLLIDING_PROPERTY_PAGE);
        expect(written).toContain(STATIC_ELEMENT_PAGE);
        expect(readPage(state.project, ELEMENT_PAGE)).toContain("GtkButton");
        expect(readPage(state.project, ELEMENT_PAGE)).not.toContain(
            "Each GTKX element rendered into it must create",
        );
        expect(readPage(state.project, COLLIDING_PROPERTY_PAGE)).toContain(
            "read with `GObject.getProperty`",
        );
        const staticElement = readPage(state.project, STATIC_ELEMENT_PAGE);
        expect(staticElement).toContain("## Static methods");
        expect(staticElement).toContain(
            "Static methods are called on `GioUnix.DesktopAppInfo`, imported from `@gtkx/gi/giounix`.",
        );
        expect(staticElement).toContain(
            "search(searchString: string): string[][]",
        );
        expect(staticElement).toContain(
            "new(desktopId: string): GioUnix.DesktopAppInfo | null",
        );
        expect(staticElement).toContain(
            "newFromFilename(filename: string): GioUnix.DesktopAppInfo | null",
        );
        expect(staticElement).toContain(
            "newFromKeyfile(keyFile: GLib.KeyFile): GioUnix.DesktopAppInfo | null",
        );
        expect(staticElement).toContain("list of strvs.");
        expect(staticElement).not.toContain("GLib.strfreev()");
        expect(staticElement).not.toContain("GLib.free()");
        const ownershipPage = readPage(state.project, OWNERSHIP_PAGE);
        expect(ownershipPage).not.toContain("GLib.free()");
        expect(ownershipPage).toContain("See also `formEncode()`");
        const authPage = readPage(state.project, AUTH_PAGE);
        expect(authPage).toContain('the "Authorization" header.');
        expect(authPage).not.toContain("which must be freed");
        const socketListenerPage = readPage(state.project, SOCKET_LISTENER_PAGE);
        expect(socketListenerPage).toContain('requesting a binding to port 0 (ie: "any port").');
        expect(socketListenerPage).toContain("stop listening");
        expect(socketListenerPage).not.toContain("belongs to the caller and must be freed");
        const resolverPage = readPage(state.project, RESOLVER_PAGE);
        expect(resolverPage).toContain("many threads it should allocate for concurrent DNS resolutions");
        expect(resolverPage).toContain("a non-empty `GList` of");
        expect(resolverPage).not.toContain("You should unref");
        expect(resolverPage).not.toContain("You must free");
        expect(resolverPage).not.toContain("g_resolver_free_addresses");
        expect(resolverPage).not.toContain("g_resolver_free_targets");
        const cookieJarPage = readPage(state.project, COOKIE_JAR_PAGE);
        expect(cookieJarPage).toContain("The cookies in the list are a copy of the original.");
        expect(cookieJarPage).toContain("For historical reasons this list is in reverse order.");
        expect(cookieJarPage).not.toContain("have to free");
        const socketPage = readPage(state.project, SOCKET_PAGE);
        expect(socketPage).toContain("source address of the received packet");
        expect(socketPage).toContain("Pass `-1` to `timeout_us` to block indefinitely");
        expect(socketPage).not.toContain("owned by the caller");
        const pangoLayoutPage = readPage(state.project, PANGO_LAYOUT_PAGE);
        expect(pangoLayoutPage).toContain("`tabs` is copied into the layout.");
        expect(pangoLayoutPage).toContain("tabs and justification conflict with each other");
        expect(pangoLayoutPage).not.toContain("you must free your copy");
        const gobjectPage = readPage(state.project, GOBJECT_PAGE);
        expect(gobjectPage).toContain("a copy is made of the property contents");
        expect(gobjectPage).not.toContain("responsible for freeing the memory");
        const iconViewPage = readPage(state.project, ICON_VIEW_PAGE);
        expect(iconViewPage).toContain("convert the returned list into a list of `GtkTreeRowReferences`");
        expect(iconViewPage).not.toContain("g_list_free_full");
        const treeSelectionPage = readPage(state.project, TREE_SELECTION_PAGE);
        expect(treeSelectionPage).toContain("convert the returned list into a list of `GtkTreeRowReference`s");
        expect(treeSelectionPage).not.toContain("g_list_free_full");
        const dbusInvocationPage = readPage(state.project, DBUS_INVOCATION_PAGE);
        expect(dbusInvocationPage).toContain("g_dbus_method_invocation_return_value");
        expect(dbusInvocationPage).not.toContain("Do not free @invocation");
        const fileEnumeratorPage = readPage(state.project, FILE_ENUMERATOR_PAGE);
        expect(fileEnumeratorPage).toContain(
            'a `false` return from\n`g_file_enumerator_iterate()` *always* means\n"error"',
        );
        expect(fileEnumeratorPage).not.toContain("do not unref it");
        expect(fileEnumeratorPage).not.toContain("g_object_unref (direnum)");
        const windowPage = readPage(state.project, WINDOW_PAGE);
        expect(windowPage).toContain("The widgets in the list are not individually referenced.");
        expect(windowPage).not.toContain(
            [
                "If you want to iterate through the list and perform actions",
                "involving callbacks that might destroy the widgets.",
            ].join("\n"),
        );
        expect(windowPage).not.toContain("g_list_foreach");
        expect(windowPage).not.toContain("To delete a `GtkWindow`.");
        const dbusConnectionPage = readPage(state.project, DBUS_CONNECTION_PAGE);
        expect(dbusConnectionPage).toContain(
            "race\ncondition where it is possible that the filter will be running even\nafter calling",
        );
        expect(dbusConnectionPage).not.toContain("user_data_free_func");
        expect(dbusConnectionPage).not.toContain("`GDestroyNotify`");
        expect(dbusConnectionPage).not.toContain("free data that the filter might be using");
        expect(dbusConnectionPage).not.toContain("\n".repeat(3));
        const pixbufPage = readPage(state.project, PIXBUF_PAGE);
        expect(pixbufPage).toContain(
            "Since you are providing a pre-allocated pixel buffer, you must also\nspecify a way to free that data.",
        );
        expect(pixbufPage).toContain("your destroy notification function will be called");
        const sidebar = readPage(state.project, SIDEBAR_PAGE);
        expect(sidebar).toContain("This remains a React `ReactNode` slot");
        expect(sidebar).toContain(
            `[AdwSidebarSection](${BASE_PATH}/adw/sidebar-section)`,
        );
        expect(readPage(state.project, APPLICATION_PAGE)).toContain(
            "https://gtkx.dev/v2/tutorial/actions-menus-shortcuts",
        );
        expect(index).toContain(BASE_PATH);
    });

    it("leaves pages that are up to date alone, and rewrites them when forced", () => {
        const before = indexStamp(state.project);
        expect(runDocs(state.project)).toBe(0);
        expect(indexStamp(state.project)).toBe(before);
        expect(runDocs(state.project, ["--force"])).toBe(0);
        expect(indexStamp(state.project)).not.toBe(before);
    });
});

describe("gtkx docs (directories it refuses to write to)", () => {
    const state: { project: CliProject } = { project: { root: "", nodeModules: "" } };

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
            config: config(`, girPath: [${JSON.stringify(FIXTURE_GIR)}]`, ["Documented-1.0"]),
        });

        expect(runDocs(project)).toBe(0);
        const page = readPage(project, DOCUMENTED_PAGE);
        expect(page).toContain(PACKAGEKIT_SEARCH_TEXT);
        expect(page).toContain("Copies the note text.");
        expect(page).toContain("**Returns** a copy of the note.");
        expect(page).toContain("**Returns** a list of strvs.");
        expect(page).toContain("- `buffer`: the buffer to copy into");
        expect(page).not.toContain("must free");
        expect(page).not.toContain("strfreev");
        expect(page).not.toContain("GLib.free()");
    });
});

describe("gtkx docs (async finish pairing)", () => {
    it("documents the paired generic finish and the remaining callback-only methods", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-docs-async-pair-",
            config: config(`, girPath: [${JSON.stringify(FIXTURE_GIR)}]`, ["AsyncPair-1.0"]),
        });

        expect(runDocs(project)).toBe(0);
        expect(readPage(project, ASYNC_SACK_PAGE)).toContain(
            "fetchAsync(cancellable?: Gio.Cancellable | null): Promise<boolean>",
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
