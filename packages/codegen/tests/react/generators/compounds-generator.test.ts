import { describe, expect, it } from "vitest";
import { fileBuilder, stringify } from "../../../src/builders/index.js";
import type { CodegenControllerMeta, CodegenWidgetMeta } from "../../../src/core/codegen-metadata.js";
import { CompoundsGenerator } from "../../../src/react/generators/compounds-generator.js";
import { MetadataReader } from "../../../src/react/metadata-reader.js";
import { createCodegenWidgetMeta } from "../../fixtures/metadata-fixtures.js";

function generate(
    widgets: readonly CodegenWidgetMeta[],
    controllers: readonly CodegenControllerMeta[] = [],
    namespaces: string[] = ["Gtk", "Adw"],
): string {
    const reader = new MetadataReader(widgets);
    const generator = new CompoundsGenerator(reader, controllers, namespaces);
    const file = fileBuilder();
    generator.generate(file);
    return stringify(file);
}

function controllerMeta(overrides: Partial<CodegenControllerMeta>): CodegenControllerMeta {
    return {
        className: "GestureClick",
        namespace: "Gtk",
        jsxName: "GtkGestureClick",
        parentClassName: "GestureSingle",
        parentNamespace: "Gtk",
        propNames: [],
        signalNames: [],
        properties: [],
        signals: [],
        doc: undefined,
        abstract: false,
        ...overrides,
    };
}

describe("CompoundsGenerator", () => {
    describe("generate", () => {
        it("emits nothing when no widgets match a compound configuration", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkLabel", className: "Label" })]);
            expect(code).toBe("");
        });

        it("emits nothing when widgets are filtered out by namespace", () => {
            const code = generate(
                [createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" })],
                [],
                ["Adw"],
            );
            expect(code).toBe("");
        });

        it("skips list-style widgets even when otherwise compound-eligible", () => {
            const code = generate([
                createCodegenWidgetMeta({ jsxName: "GtkListView", className: "ListView" }),
                createCodegenWidgetMeta({ jsxName: "GtkDropDown", className: "DropDown" }),
            ]);
            expect(code).toBe("");
        });

        it("emits a slot-only compound for widgets with renderable slots and no sub-components", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" })]);
            expect(code).toContain("export const GtkWindow");
            expect(code).toContain('createSlotWidget<GtkWindowProps>("GtkWindow", ["titlebar"])');
            expect(code).not.toContain("Object.assign(");
        });

        it("emits a container-method compound with PascalCase sub-components", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkActionBar", className: "ActionBar" })]);
            expect(code).toContain("export const GtkActionBar");
            expect(code).toContain("Object.assign(");
            expect(code).toContain("PackStart: ");
            expect(code).toContain("PackEnd: ");
            expect(code).toContain('createContainerSlotChild("packStart")');
            expect(code).toContain('createContainerSlotChild("packEnd")');
        });

        it("emits a virtual-child compound for widgets with virtualChildren config", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkGrid", className: "Grid" })]);
            expect(code).toContain("export const GtkGrid");
            expect(code).toContain('createVirtualChild<GridChildProps>("GridChild")');
            expect(code).toContain("Child: (props: GridChildProps) => ReactNode");
        });

        it("emits menu sub-components for menu-host widgets", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkPopoverMenu", className: "PopoverMenu" })]);
            expect(code).toContain('createVirtualChild<MenuItemProps>("MenuItem")');
            expect(code).toContain('createVirtualChild<MenuSectionProps>("MenuSection")');
            expect(code).toContain('createVirtualChild<MenuSubmenuProps>("MenuSubmenu")');
        });

        it("emits navigation-page sub-components for navigation-page widgets", () => {
            const code = generate([
                createCodegenWidgetMeta({
                    jsxName: "AdwNavigationView",
                    className: "NavigationView",
                    namespace: "Adw",
                }),
            ]);
            expect(code).toContain("export const AdwNavigationView");
            expect(code).toContain('createNavigationPageChild<NavigationViewPageProps>("AdwNavigationView")');
            expect(code).toContain("Page: (props: NavigationViewPageProps) => ReactNode");
        });

        it("combines container methods, renderable slots, and menu host on the same widget", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkMenuButton", className: "MenuButton" })]);
            expect(code).toContain('createSlotWidget<GtkMenuButtonProps>("GtkMenuButton", ["popover"])');
            expect(code).toContain('createVirtualChild<MenuItemProps>("MenuItem")');
        });

        it("emits ContainerSlotNames type listing every container compound", () => {
            const code = generate([
                createCodegenWidgetMeta({ jsxName: "GtkActionBar", className: "ActionBar" }),
                createCodegenWidgetMeta({ jsxName: "AdwHeaderBar", className: "HeaderBar", namespace: "Adw" }),
            ]);
            expect(code).toContain("export type ContainerSlotNames = {");
            expect(code).toContain('GtkActionBar: "packStart" | "packEnd"');
            expect(code).toContain('AdwHeaderBar: "packStart" | "packEnd"');
        });

        it("omits ContainerSlotNames when no compound has container methods", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkGrid", className: "Grid" })]);
            expect(code).not.toContain("ContainerSlotNames");
        });

        it("sorts emitted compounds alphabetically by jsxName", () => {
            const code = generate([
                createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" }),
                createCodegenWidgetMeta({ jsxName: "GtkActionBar", className: "ActionBar" }),
                createCodegenWidgetMeta({ jsxName: "GtkGrid", className: "Grid" }),
            ]);
            const actionBarIdx = code.indexOf("export const GtkActionBar");
            const gridIdx = code.indexOf("export const GtkGrid");
            const windowIdx = code.indexOf("export const GtkWindow");
            expect(actionBarIdx).toBeGreaterThan(-1);
            expect(gridIdx).toBeGreaterThan(actionBarIdx);
            expect(windowIdx).toBeGreaterThan(gridIdx);
        });

        it("emits a controller-driven compound when controller has navigation-page children", () => {
            const code = generate(
                [],
                [
                    controllerMeta({
                        jsxName: "AdwNavigationView",
                        className: "NavigationView",
                        namespace: "Adw",
                    }),
                ],
            );
            expect(code).toContain("export const AdwNavigationView");
            expect(code).toContain("Page: (props: NavigationViewPageProps)");
        });

        it("excludes controllers whose namespace is filtered out", () => {
            const code = generate(
                [],
                [
                    controllerMeta({
                        jsxName: "AdwNavigationView",
                        className: "NavigationView",
                        namespace: "Adw",
                    }),
                ],
                ["Gtk"],
            );
            expect(code).toBe("");
        });

        it("ignores controllers without compound children configuration", () => {
            const code = generate([], [controllerMeta({ jsxName: "GtkGestureClick", className: "GestureClick" })]);
            expect(code).toBe("");
        });

        it("uses widget documentation comment when available", () => {
            const code = generate([
                createCodegenWidgetMeta({
                    jsxName: "GtkWindow",
                    className: "Window",
                    doc: "Top-level window.\nDocumentation continues here.",
                }),
            ]);
            expect(code).toContain("Top-level window");
        });

        it("falls back to a generic doc comment when no widget doc is provided", () => {
            const code = generate([createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" })]);
            expect(code).toContain("A Gtk.Window widget element");
        });
    });

    describe("getCompoundJsxNames", () => {
        it("returns the set of jsxNames that produce a compound", () => {
            const reader = new MetadataReader([
                createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" }),
                createCodegenWidgetMeta({ jsxName: "GtkLabel", className: "Label" }),
            ]);
            const generator = new CompoundsGenerator(reader, [], ["Gtk", "Adw"]);
            const names = generator.getCompoundJsxNames();
            expect(names.has("GtkWindow")).toBe(true);
            expect(names.has("GtkLabel")).toBe(false);
        });

        it("memoizes compound collection across calls", () => {
            const reader = new MetadataReader([createCodegenWidgetMeta({ jsxName: "GtkWindow", className: "Window" })]);
            const generator = new CompoundsGenerator(reader, [], ["Gtk", "Adw"]);
            const first = generator.getCompoundJsxNames();
            const second = generator.getCompoundJsxNames();
            expect(first).toEqual(second);
        });
    });
});
