import { describe, expect, it } from "vitest";
import { type ApiReference, loadApiReference } from "../../src/index.js";

type PageResult = Extract<ReturnType<ApiReference["lookup"]>, { outcome: "page" }>;

const GIR_PATH = ["/usr/share/gir-1.0"];
const reference = loadApiReference({ libraries: ["Gtk-4.0", "Adw-1"], girPath: GIR_PATH });

const DBUS_CONNECTION_NEW_SIGNATURE =
    "new(stream: Gio.IOStream, guid: string | null, flags: Gio.DBusConnectionFlags, " +
    "observer: Gio.DBusAuthObserver | null, cancellable?: Gio.Cancellable | null): Promise<Gio.DBusConnection>";

const pageResultFor = (query: string): PageResult => {
    const result = reference.lookup(query);

    if (result.outcome !== "page") {
        throw new Error(`Expected a page for ${query}, got ${result.outcome}`);
    }

    return result;
};

const pageFor = (query: string): string => pageResultFor(query).markdown;
const symbolNameFor = (query: string): string => pageResultFor(query).symbol.name;

const candidateNamespacesFor = (query: string): string[] => {
    const result = reference.lookup(query);

    if (result.outcome !== "ambiguous") {
        throw new Error(`Expected ambiguous candidates for ${query}, got ${result.outcome}`);
    }

    return result.candidates.map((candidate) => candidate.namespace);
};

const registerClassPageTests = (): void => {
    it("renders a class page with hierarchy, constructors, properties, signals, and methods", () => {
        const page = pageFor("Gtk.Button");
        expect(page).toContain("# Gtk.Button");
        expect(page).toContain("`class` in `@gtkx/gi/gtk`");
        expect(page).toContain('import * as Gtk from "@gtkx/gi/gtk";');
        expect(page).toContain("Also available as the `GtkButton` JSX element");
        expect(page).toContain("## Hierarchy");
        expect(page).toContain("`GObject.Object` → ");
        expect(page).toContain("**Gtk.Button**");
        expect(page).toContain("Implements `Gtk.Accessible`, `Gtk.Actionable`");
        expect(page).toContain("## Constructors");
        expect(page).toContain("newWithLabel(label: string): Gtk.Button");
        expect(page).toContain("## Properties");
        expect(page).toContain("### `label`");
        expect(page).toContain("default `null`");
        expect(page).toContain("default `true`");
        expect(page).not.toContain("default `TRUE`");
        expect(page).toContain("## Signals");
        expect(page).toContain("### `clicked`");
        expect(page).toContain("() => void");
        expect(page).not.toContain("(self: Gtk.Button) => void");
        expect(page).toContain("## Methods");
        expect(page).toContain("setLabel(label: string): void");
    });

    it("omits properties whose names are claimed by generated methods", () => {
        const page = pageFor("Gtk.Widget");
        const propertiesSection = page.slice(page.indexOf("## Properties"), page.indexOf("## Signals"));
        expect(propertiesSection).not.toContain("### `hasFocus`");
        expect(propertiesSection).not.toContain("### `hasDefault`");
        expect(page).toContain("hasFocus(): boolean");
    });

    it("renders promisified async method pairs on class pages", () => {
        const page = pageFor("Gtk.FileDialog");

        expect(page).toContain(
            "open(parent: Gtk.Window | null, cancellable?: Gio.Cancellable | null): Promise<Gio.File>",
        );
    });
};

const registerPromisifiedPageTests = (): void => {
    it("renders promisified static async members on class pages", () => {
        const page = pageFor("Gio.DBusConnection");
        expect(page).toContain(DBUS_CONNECTION_NEW_SIGNATURE);
        expect(page).toContain("newFinish(res: Gio.AsyncResult): Gio.DBusConnection");
    });

    it("renders promisified module-level async functions on function pages", () => {
        const page = pageFor("Gio.busGet");

        expect(page).toContain(
            "function busGet(busType: Gio.BusType, cancellable?: Gio.Cancellable | null): Promise<Gio.DBusConnection>",
        );

        const finishPage = pageFor("Gio.busGetFinish");
        expect(finishPage).toContain("function busGetFinish(res: Gio.AsyncResult): Gio.DBusConnection");
    });
};

const registerSymbolPageTests = (): void => {
    it("renders an interface page with prerequisites", () => {
        const page = pageFor("Gtk.Orientable");
        expect(page).toContain("# Gtk.Orientable");
        expect(page).toContain("`interface` in `@gtkx/gi/gtk`");
        expect(page).toContain("### `orientation`");
    });

    it("renders an element page for JSX element names", () => {
        const page = pageFor("GtkButton");
        expect(page).toContain("# GtkButton");
        expect(page).toContain('import { GtkButton } from "@gtkx/jsx/gtk";');
        expect(page).toContain("## Props");
        expect(page).toContain("### `onClicked`");
    });

    it("renders an enum page with a member table", () => {
        const page = pageFor("Gtk.Orientation");
        expect(page).toContain("# Gtk.Orientation");
        expect(page).toContain("`enumeration` in `@gtkx/gi/gtk`");
        expect(page).toContain("| Member | Value | Description |");
        expect(page).toContain("| `HORIZONTAL` | `0` |");
        expect(page).toContain("Members are accessed as `Gtk.Orientation.<member>`.");
    });

    it("renders a record page with constructors, fields, and methods", () => {
        const page = pageFor("Gdk.RGBA");
        expect(page).toContain("# Gdk.RGBA");
        expect(page).toContain("`record` in `@gtkx/gi/gdk`");
        expect(page).toContain("## Fields");
        expect(page).toContain("### `red`");
        expect(page).toContain("## Methods");
        expect(page).toContain("toString(): string");
    });

    it("omits record fields that the generated class does not expose", () => {
        const page = pageFor("GLib.MarkupParser");
        expect(page).not.toContain("### `startElement`");
        expect(page).not.toContain("## Fields");
    });

    it("renders a callback page with the handler signature", () => {
        const page = pageFor("Gtk.TickCallback");
        expect(page).toContain("`callback` in `@gtkx/gi/gtk`");
        expect(page).toContain("type TickCallback = (widget: Gtk.Widget, frameClock: Gdk.FrameClock) => boolean");
    });
};

const registerLookupResolutionTests = (): void => {
    it("renders alias, constant, and function pages", () => {
        expect(pageFor("GLib.Quark")).toContain("type Quark = number");
        const constant = pageFor("Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION");
        expect(constant).toContain("const STYLE_PROVIDER_PRIORITY_APPLICATION: number = 600");
        const fn = pageFor("GLib.idleAdd");
        expect(fn).toContain("`function` in `@gtkx/gi/glib`");
        expect(fn).toContain("function idleAdd(");
    });

    it("resolves bare names when unambiguous and is case-insensitive", () => {
        const result = reference.lookup("gtk.button");
        expect(result.outcome).toBe("page");
        expect(pageFor("Button")).toContain("# Gtk.Button");
    });

    it("reports ambiguity with candidates and honors the kind filter", () => {
        const namespaces = candidateNamespacesFor("HeaderBar");
        expect(namespaces).toContain("Gtk");
        expect(namespaces).toContain("Adw");
        expect(reference.lookup("Adw.HeaderBar", "class").outcome).toBe("page");
    });

    it("prefers an exact case-sensitive match over case-colliding candidates", () => {
        expect(symbolNameFor("Gdk.KEY_a")).toBe("KEY_a");
        expect(symbolNameFor("Gdk.KEY_A")).toBe("KEY_A");
        expect(reference.lookup("GObject.TypeQuery").outcome).toBe("page");
        expect(reference.lookup("GObject.typeQuery").outcome).toBe("page");
    });

    it("reports notFound for unknown symbols", () => {
        expect(reference.lookup("Gtk.DoesNotExist").outcome).toBe("notFound");
        expect(reference.lookup("").outcome).toBe("notFound");
    });
};

describe("ApiReference — namespaces", () => {
    it("lists every pulled-in namespace with symbol and element counts", () => {
        const summaries = reference.namespaces();
        const names = summaries.map((summary) => summary.name);
        expect(names).toContain("Gtk");
        expect(names).toContain("Adw");
        expect(names).toContain("GLib");
        const gtk = summaries.find((summary) => summary.name === "Gtk");
        expect(gtk?.importPath).toBe("@gtkx/gi/gtk");
        expect(gtk?.symbols).toBeGreaterThan(500);
        expect(gtk?.elements).toBeGreaterThan(200);
    });

    it("renders the root overview with a namespace table", () => {
        const overview = reference.overview();
        expect(overview).toContain("# API Reference");
        expect(overview).toContain("`Gtk-4.0`");
        expect(overview).toContain("| Gtk | `@gtkx/gi/gtk` |");
    });

    it("renders a namespace overview grouped by kind", () => {
        const overview = reference.namespaceOverview("gtk");
        expect(overview).toContain("# Gtk");
        expect(overview).toContain('import * as Gtk from "@gtkx/gi/gtk";');
        expect(overview).toContain("## JSX elements");
        expect(overview).toContain("`GtkButton`");
        expect(overview).toContain("## Classes");
        expect(overview).toContain("`Button`");
        expect(overview).toContain("## Enums");
        expect(overview).toContain("`Orientation`");
        expect(reference.namespaceOverview("Nope")).toBeUndefined();
    });

    it("lists symbol names for completion", () => {
        const names = reference.symbolNames("Gtk");
        expect(names).toContain("Button");
        expect(names).toContain("GtkButton");
        expect(names).toContain("Orientation");
        expect(reference.symbolNames("Nope")).toEqual([]);
    });
});

describe("ApiReference — lookup", () => {
    registerClassPageTests();
    registerPromisifiedPageTests();
    registerSymbolPageTests();
    registerLookupResolutionTests();
});

describe("ApiReference — search", () => {
    it("ranks exact name matches first", () => {
        const results = reference.search({ query: "button" });
        expect(results[0]?.name).toBe("Button");
        expect(results[0]?.kind).toBe("class");
        expect(results[0]?.summary.length).toBeGreaterThan(0);
    });

    it("filters by namespace and kind and honors the limit", () => {
        const results = reference.search({ query: "header", namespace: "Adw", kinds: ["element"], limit: 2 });
        expect(results.length).toBeLessThanOrEqual(2);

        for (const result of results) {
            expect(result.namespace).toBe("Adw");
            expect(result.kind).toBe("element");
        }

        expect(results.map((result) => result.name)).toContain("AdwHeaderBar");
    });

    it("returns nothing for an empty query", () => {
        expect(reference.search({ query: "  " })).toEqual([]);
    });

    it("clamps a non-positive limit to one result", () => {
        expect(reference.search({ query: "button", limit: -1 })).toHaveLength(1);
    });
});

describe("symbols", () => {
    it("enumerates without a query, which search cannot do", () => {
        expect(reference.search({ query: "" })).toEqual([]);
        expect(reference.symbols().length).toBeGreaterThan(500);
    });

    it("lists every JSX element", () => {
        const elements = reference.symbols({ kinds: ["element"] });
        expect(elements.every((symbol) => symbol.kind === "element")).toBe(true);
        expect(elements.map((symbol) => symbol.name)).toContain("GtkButton");
    });

    it("narrows to one namespace", () => {
        const adw = reference.symbols({ namespace: "Adw" });
        expect(adw.length).toBeGreaterThan(0);
        expect(adw.every((symbol) => symbol.namespace === "Adw")).toBe(true);
    });

    it("orders namespaces before names", () => {
        const names = reference.symbols({ namespace: "Adw", kinds: ["element"] }).map((symbol) => symbol.name);
        expect(names).toEqual([...names].toSorted((a, b) => a.localeCompare(b)));
    });
});
