import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, STORE_LIBRARIES } from "./cli-project.js";
import {
    BASE_PATH,
    CALLBACK_ACTION_PAGE,
    config,
    docsDir,
    MENU_ITEM_PAGE,
    readPage,
    runDocs,
    SHORTCUT_TRIGGER_PAGE,
} from "./docs-fixture.js";

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
const SIDEBAR_PAGE = "adw/sidebar.md";
const APPLICATION_PAGE = "adw/application.md";
const REFERENCE_LIBRARIES = [...STORE_LIBRARIES, "GioUnix-2.0"];
const indexStamp = (project: CliProject): number => statSync(join(docsDir(project), INDEX_PAGE)).mtimeMs;

describe("gtkx docs", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "", tmpDir: "" },
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

    it("documents selected menu item fields and its declarative menu slots", () => {
        expect(state.status).toBe(0);
        const page = readPage(state.project, MENU_ITEM_PAGE);

        expect(page).toContain("### `label`");
        expect(page).toContain("### `action`");
        expect(page).toContain("Text shown for the entry");
        expect(page).toContain("Detailed action name the entry activates");
        expect(page).toContain("### `submenu`");
        expect(page).toContain("### `section`");
        expect(page).toContain("`ReactNode`");
        expect(page).not.toContain("`MenuItem[]`");
    });

    it("documents factory-backed element props", () => {
        expect(state.status).toBe(0);
        expect(readPage(state.project, CALLBACK_ACTION_PAGE)).toContain("### `callback`");
        expect(readPage(state.project, SHORTCUT_TRIGGER_PAGE)).toContain("### `accelerator`");
    });
});
