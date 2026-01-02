import { describe, expect, it } from "vitest";
import { FfiAstAnalyzer } from "../../../src/react/analyzers/ffi-ast-analyzer.js";
import {
    createFfiProjectWithWidget,
    createFfiProjectWithWidgets,
    createTestProject,
} from "../../fixtures/ts-morph-helpers.js";

function createFfiProjectWithMultipleWidgets() {
    return createFfiProjectWithWidgets([
        { namespace: "Gtk", className: "Button", isContainer: true, slots: ["child", "icon"] },
        { namespace: "Gtk", className: "Label", isContainer: false, slots: [] },
        { namespace: "Adw", className: "HeaderBar", isContainer: true, slots: ["start", "end", "title-widget"] },
    ]);
}

describe("FfiAstAnalyzer", () => {
    describe("constructor", () => {
        it("creates analyzer with project", () => {
            const project = createTestProject();
            const analyzer = new FfiAstAnalyzer(project);
            expect(analyzer).toBeInstanceOf(FfiAstAnalyzer);
        });
    });

    describe("getWidgetMeta", () => {
        it("returns null for non-existent widget", () => {
            const project = createTestProject();
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "NonExistent");

            expect(meta).toBeNull();
        });

        it("returns metadata for widget with WIDGET_META", () => {
            const project = createFfiProjectWithWidget("Gtk", "Button", {
                isContainer: true,
                slots: ["child"],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Button");

            expect(meta).not.toBeNull();
            expect(meta?.isContainer).toBe(true);
            expect(meta?.slots).toEqual(["child"]);
        });

        it("returns isContainer false when WIDGET_META has isContainer false", () => {
            const project = createFfiProjectWithWidget("Gtk", "Label", {
                isContainer: false,
                slots: [],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Label");

            expect(meta?.isContainer).toBe(false);
        });

        it("returns empty slots array when no slots defined", () => {
            const project = createFfiProjectWithWidget("Gtk", "Label", {
                isContainer: false,
                slots: [],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Label");

            expect(meta?.slots).toEqual([]);
        });

        it("returns multiple slots when defined", () => {
            const project = createFfiProjectWithWidget("Gtk", "Box", {
                isContainer: true,
                slots: ["start", "center", "end"],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Box");

            expect(meta?.slots).toEqual(["start", "center", "end"]);
        });

        it("handles cross-namespace widgets", () => {
            const project = createFfiProjectWithWidget("Adw", "HeaderBar", {
                isContainer: true,
                slots: ["start", "end"],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Adw", "HeaderBar");

            expect(meta).not.toBeNull();
            expect(meta?.isContainer).toBe(true);
        });
    });

    describe("isContainer", () => {
        it("returns true when widget is container", () => {
            const project = createFfiProjectWithWidget("Gtk", "Box", {
                isContainer: true,
            });
            const analyzer = new FfiAstAnalyzer(project);

            expect(analyzer.isContainer("Gtk", "Box")).toBe(true);
        });

        it("returns false when widget is not container", () => {
            const project = createFfiProjectWithWidget("Gtk", "Label", {
                isContainer: false,
            });
            const analyzer = new FfiAstAnalyzer(project);

            expect(analyzer.isContainer("Gtk", "Label")).toBe(false);
        });

        it("returns false for non-existent widget", () => {
            const project = createTestProject();
            const analyzer = new FfiAstAnalyzer(project);

            expect(analyzer.isContainer("Gtk", "NonExistent")).toBe(false);
        });
    });

    describe("getSlots", () => {
        it("returns slots array for widget with slots", () => {
            const project = createFfiProjectWithWidget("Gtk", "Button", {
                isContainer: true,
                slots: ["child", "icon"],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const slots = analyzer.getSlots("Gtk", "Button");

            expect(slots).toEqual(["child", "icon"]);
        });

        it("returns empty array for widget without slots", () => {
            const project = createFfiProjectWithWidget("Gtk", "Label", {
                isContainer: false,
                slots: [],
            });
            const analyzer = new FfiAstAnalyzer(project);

            const slots = analyzer.getSlots("Gtk", "Label");

            expect(slots).toEqual([]);
        });

        it("returns empty array for non-existent widget", () => {
            const project = createTestProject();
            const analyzer = new FfiAstAnalyzer(project);

            const slots = analyzer.getSlots("Gtk", "NonExistent");

            expect(slots).toEqual([]);
        });
    });

    describe("getNamespaceMetaMap", () => {
        it("returns map of all widgets in namespace", () => {
            const project = createFfiProjectWithMultipleWidgets();
            const analyzer = new FfiAstAnalyzer(project);

            const metaMap = analyzer.getNamespaceMetaMap("Gtk");

            expect(metaMap.size).toBe(2);
            expect(metaMap.has("Button")).toBe(true);
            expect(metaMap.has("Label")).toBe(true);
        });

        it("returns empty map for namespace without widgets", () => {
            const project = createTestProject();
            const analyzer = new FfiAstAnalyzer(project);

            const metaMap = analyzer.getNamespaceMetaMap("NonExistent");

            expect(metaMap.size).toBe(0);
        });

        it("separates widgets by namespace", () => {
            const project = createFfiProjectWithMultipleWidgets();
            const analyzer = new FfiAstAnalyzer(project);

            const gtkMap = analyzer.getNamespaceMetaMap("Gtk");
            const adwMap = analyzer.getNamespaceMetaMap("Adw");

            expect(gtkMap.has("Button")).toBe(true);
            expect(gtkMap.has("HeaderBar")).toBe(false);
            expect(adwMap.has("HeaderBar")).toBe(true);
            expect(adwMap.has("Button")).toBe(false);
        });
    });

    describe("caching", () => {
        it("caches namespace meta map", () => {
            const project = createFfiProjectWithWidget("Gtk", "Button", {
                isContainer: true,
            });
            const analyzer = new FfiAstAnalyzer(project);

            const firstCall = analyzer.getNamespaceMetaMap("Gtk");
            const secondCall = analyzer.getNamespaceMetaMap("Gtk");

            expect(firstCall).toBe(secondCall);
        });

        it("caches separate maps per namespace", () => {
            const project = createFfiProjectWithMultipleWidgets();
            const analyzer = new FfiAstAnalyzer(project);

            const gtkMap = analyzer.getNamespaceMetaMap("Gtk");
            const adwMap = analyzer.getNamespaceMetaMap("Adw");

            expect(gtkMap).not.toBe(adwMap);
        });
    });

    describe("file without WIDGET_META", () => {
        it("ignores files without WIDGET_META property", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    someMethod() {}
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Button");

            expect(meta).toBeNull();
        });

        it("ignores files without class declarations", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/utils.ts",
                `
                export const SOME_CONSTANT = 42;
                export function someFunction() {}
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const metaMap = analyzer.getNamespaceMetaMap("Gtk");

            expect(metaMap.size).toBe(0);
        });
    });

    describe("WIDGET_META parsing edge cases", () => {
        it("handles WIDGET_META without as const", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: ["child"],
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Button");

            expect(meta?.isContainer).toBe(true);
            expect(meta?.slots).toEqual(["child"]);
        });

        it("handles slots with as const on array", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: ["child", "icon"] as const,
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Button");

            expect(meta?.slots).toEqual(["child", "icon"]);
        });
    });

    describe("class name derivation", () => {
        it("derives PascalCase class name from kebab-case file name", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/header-bar.ts",
                `
                export class HeaderBar {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: [] as const,
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "HeaderBar");

            expect(meta).not.toBeNull();
        });

        it("handles single-word file names", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: [] as const,
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const meta = analyzer.getWidgetMeta("Gtk", "Button");

            expect(meta).not.toBeNull();
        });
    });

    describe("namespace path matching", () => {
        it("matches files in namespace subdirectory", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: [] as const,
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const metaMap = analyzer.getNamespaceMetaMap("Gtk");

            expect(metaMap.size).toBe(1);
        });

        it("is case-insensitive for namespace matching", () => {
            const project = createTestProject();
            project.createSourceFile(
                "ffi/gtk/button.ts",
                `
                export class Button {
                    static readonly WIDGET_META = {
                        isContainer: true,
                        slots: [] as const,
                    };
                }
            `,
            );
            const analyzer = new FfiAstAnalyzer(project);

            const metaMap = analyzer.getNamespaceMetaMap("GTK");

            expect(metaMap.size).toBe(1);
        });
    });
});
