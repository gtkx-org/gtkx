import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../../src/core/generation-context.js";
import { ImportsBuilder } from "../../../src/core/writers/imports-builder.js";
import { createTestProject, createTestSourceFile } from "../../fixtures/ts-morph-helpers.js";

function createTestSetup(options: Parameters<typeof ImportsBuilder>[1] = { namespace: "Gtk" }) {
    const ctx = new GenerationContext();
    const builder = new ImportsBuilder(ctx, options);
    return { ctx, builder };
}

describe("ImportsBuilder", () => {
    describe("collectImports", () => {
        describe("native imports", () => {
            it("returns empty array when no flags set", () => {
                const { builder } = createTestSetup();
                const imports = builder.collectImports();

                expect(imports).toHaveLength(0);
            });

            it("collects @gtkx/native imports based on flags", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesRef = true;
                ctx.usesAlloc = true;
                ctx.usesRead = true;

                const imports = builder.collectImports();

                const nativeImport = imports.find((i) => i.moduleSpecifier === "@gtkx/native");
                expect(nativeImport).toBeDefined();
                expect(nativeImport?.namedImports).toContain("Ref");
                expect(nativeImport?.namedImports).toContain("alloc");
                expect(nativeImport?.namedImports).toContain("read");
            });

            it("collects write and Type imports", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesWrite = true;
                ctx.usesType = true;

                const imports = builder.collectImports();

                const nativeImport = imports.find((i) => i.moduleSpecifier === "@gtkx/native");
                expect(nativeImport?.namedImports).toContain("write");
                expect(nativeImport?.namedImports).toContain("Type");
            });
        });

        describe("call import", () => {
            it("collects call from batch module", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesCall = true;

                const imports = builder.collectImports();

                const callImport = imports.find((i) => i.namedImports?.includes("call"));
                expect(callImport).toBeDefined();
                expect(callImport?.moduleSpecifier).toContain("batch");
            });
        });

        describe("error imports", () => {
            it("collects NativeError import", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesNativeError = true;

                const imports = builder.collectImports();

                const errorImport = imports.find((i) => i.namedImports?.includes("NativeError"));
                expect(errorImport).toBeDefined();
            });
        });

        describe("native object imports", () => {
            it("collects getNativeObject import", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesGetNativeObject = true;

                const imports = builder.collectImports();

                const import_ = imports.find((i) => i.namedImports?.includes("getNativeObject"));
                expect(import_).toBeDefined();
            });
        });

        describe("base imports", () => {
            it("collects instantiating helpers", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesInstantiating = true;

                const imports = builder.collectImports();

                const baseImport = imports.find(
                    (i) => i.namedImports?.includes("isInstantiating") && i.namedImports?.includes("setInstantiating"),
                );
                expect(baseImport).toBeDefined();
            });

            it("collects NativeObject base class", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesNativeObject = true;

                const imports = builder.collectImports();

                const baseImport = imports.find((i) => i.namedImports?.includes("NativeObject"));
                expect(baseImport).toBeDefined();
            });
        });

        describe("registry imports", () => {
            it("collects registerNativeClass", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesRegisterNativeClass = true;

                const imports = builder.collectImports();

                const registryImport = imports.find((i) => i.namedImports?.includes("registerNativeClass"));
                expect(registryImport).toBeDefined();
            });

            it("collects getNativeClass", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesGetClassByTypeName = true;

                const imports = builder.collectImports();

                const registryImport = imports.find((i) => i.namedImports?.includes("getNativeClass"));
                expect(registryImport).toBeDefined();
            });
        });

        describe("signal meta imports", () => {
            it("collects resolveSignalMeta", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesResolveSignalMeta = true;

                const imports = builder.collectImports();

                const import_ = imports.find((i) => i.namedImports?.includes("resolveSignalMeta"));
                expect(import_).toBeDefined();
            });

            it("collects RuntimeWidgetMeta as type-only", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usesRuntimeWidgetMeta = true;

                const imports = builder.collectImports();

                const import_ = imports.find((i) => i.typeOnlyImports?.includes("RuntimeWidgetMeta"));
                expect(import_).toBeDefined();
            });
        });

        describe("enum imports", () => {
            it("collects enums from ./enums.js", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedEnums.add("Orientation");
                ctx.usedEnums.add("Align");

                const imports = builder.collectImports();

                const enumImport = imports.find((i) => i.moduleSpecifier === "./enums.js");
                expect(enumImport).toBeDefined();
                expect(enumImport?.namedImports).toContain("Orientation");
                expect(enumImport?.namedImports).toContain("Align");
            });

            it("sorts enum imports alphabetically", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedEnums.add("Orientation");
                ctx.usedEnums.add("Align");
                ctx.usedEnums.add("BaselinePosition");

                const imports = builder.collectImports();

                const enumImport = imports.find((i) => i.moduleSpecifier === "./enums.js");
                expect(enumImport?.namedImports).toEqual(["Align", "BaselinePosition", "Orientation"]);
            });
        });

        describe("record imports", () => {
            it("collects record imports with kebab-case paths", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedRecords.add("Rectangle");

                const imports = builder.collectImports();

                const recordImport = imports.find((i) => i.namedImports?.includes("Rectangle"));
                expect(recordImport).toBeDefined();
                expect(recordImport?.moduleSpecifier).toBe("./rectangle.js");
            });

            it("excludes current class from record imports", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk", currentClassName: "Rectangle" });
                ctx.usedRecords.add("Rectangle");

                const imports = builder.collectImports();

                const recordImport = imports.find((i) => i.namedImports?.includes("Rectangle"));
                expect(recordImport).toBeUndefined();
            });

            it("uses recordNameToFile mapping for file paths", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedRecords.add("RGBA");
                ctx.recordNameToFile.set("RGBA", "rgba");

                const imports = builder.collectImports();

                const recordImport = imports.find((i) => i.namedImports?.includes("RGBA"));
                expect(recordImport?.moduleSpecifier).toBe("./rgba.js");
            });
        });

        describe("interface imports", () => {
            it("collects interface imports", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedInterfaces.set("Orientable", "Orientable");

                const imports = builder.collectImports();

                const ifaceImport = imports.find((i) => i.namedImports?.includes("Orientable"));
                expect(ifaceImport).toBeDefined();
                expect(ifaceImport?.moduleSpecifier).toBe("./orientable.js");
            });

            it("excludes current class from interface imports", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk", currentClassName: "Orientable" });
                ctx.usedInterfaces.set("Orientable", "Orientable");

                const imports = builder.collectImports();

                const ifaceImport = imports.find((i) => i.namedImports?.includes("Orientable"));
                expect(ifaceImport).toBeUndefined();
            });
        });

        describe("parent class imports", () => {
            it("collects same-namespace parent class import", () => {
                const { builder } = createTestSetup({
                    namespace: "Gtk",
                    parentClassName: "Widget",
                    parentOriginalName: "Widget",
                });

                const imports = builder.collectImports();

                const parentImport = imports.find((i) => i.namedImports?.includes("Widget"));
                expect(parentImport).toBeDefined();
                expect(parentImport?.moduleSpecifier).toBe("./widget.js");
            });

            it("skips parent import when parentNamespace is set (cross-namespace)", () => {
                const { builder } = createTestSetup({
                    namespace: "Adw",
                    parentClassName: "Widget",
                    parentOriginalName: "Widget",
                    parentNamespace: "Gtk",
                });

                const imports = builder.collectImports();

                const parentImport = imports.find((i) => i.moduleSpecifier === "./widget.js");
                expect(parentImport).toBeUndefined();
            });
        });

        describe("class imports", () => {
            it("collects same-namespace class imports", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedSameNamespaceClasses.set("Button", "Button");
                ctx.usedSameNamespaceClasses.set("Label", "Label");

                const imports = builder.collectImports();

                const buttonImport = imports.find((i) => i.namedImports?.includes("Button"));
                const labelImport = imports.find((i) => i.namedImports?.includes("Label"));
                expect(buttonImport?.moduleSpecifier).toBe("./button.js");
                expect(labelImport?.moduleSpecifier).toBe("./label.js");
            });

            it("excludes current class from class imports", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk", currentClassName: "Button" });
                ctx.usedSameNamespaceClasses.set("Button", "Button");

                const imports = builder.collectImports();

                const buttonImport = imports.find((i) => i.namedImports?.includes("Button"));
                expect(buttonImport).toBeUndefined();
            });

            it("excludes parent class from class imports", () => {
                const { ctx, builder } = createTestSetup({
                    namespace: "Gtk",
                    parentClassName: "Widget",
                    parentOriginalName: "Widget",
                });
                ctx.usedSameNamespaceClasses.set("Widget", "Widget");
                ctx.usedSameNamespaceClasses.set("Button", "Button");

                const imports = builder.collectImports();

                const classImports = imports.filter(
                    (i) => i.namedImports?.includes("Widget") && i.moduleSpecifier !== "./widget.js",
                );
                expect(classImports).toHaveLength(0);
            });

            it("excludes signal classes from regular class imports", () => {
                const { ctx, builder } = createTestSetup();
                ctx.usedSameNamespaceClasses.set("Button", "Button");
                ctx.signalClasses.set("Button", "Button");

                const imports = builder.collectImports();

                const regularClassImports = imports.filter((i) => i.namedImports?.includes("Button"));
                expect(regularClassImports).toHaveLength(1);
            });
        });

        describe("signal class imports", () => {
            it("collects signal class imports separately", () => {
                const { ctx, builder } = createTestSetup();
                ctx.signalClasses.set("Widget", "Widget");

                const imports = builder.collectImports();

                const signalImport = imports.find((i) => i.namedImports?.includes("Widget"));
                expect(signalImport).toBeDefined();
                expect(signalImport?.moduleSpecifier).toBe("./widget.js");
            });

            it("excludes current class from signal imports", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk", currentClassName: "Button" });
                ctx.signalClasses.set("Button", "Button");

                const imports = builder.collectImports();

                const signalImport = imports.find(
                    (i) => i.namedImports?.includes("Button") && i.moduleSpecifier === "./button.js",
                );
                expect(signalImport).toBeUndefined();
            });
        });

        describe("external namespace imports", () => {
            it("collects external namespace as namespace import", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk" });
                ctx.usedExternalTypes.set("Gdk.Rectangle", {
                    namespace: "Gdk",
                    name: "Rectangle",
                    transformedName: "Rectangle",
                    kind: "record",
                });

                const imports = builder.collectImports();

                const gdkImport = imports.find((i) => i.namespaceImport === "Gdk");
                expect(gdkImport).toBeDefined();
                expect(gdkImport?.moduleSpecifier).toBe("../gdk/index.js");
            });

            it("adds Gio namespace when addGioImport is true", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk" });
                ctx.addGioImport = true;

                const imports = builder.collectImports();

                const gioImport = imports.find((i) => i.namespaceImport === "Gio");
                expect(gioImport).toBeDefined();
            });

            it("skips Gio import when current namespace is Gio", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gio" });
                ctx.addGioImport = true;

                const imports = builder.collectImports();

                const gioImport = imports.find((i) => i.namespaceImport === "Gio");
                expect(gioImport).toBeUndefined();
            });

            it("adds GObject namespace when usesGObjectNamespace is true", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk" });
                ctx.usesGObjectNamespace = true;

                const imports = builder.collectImports();

                const gobjectImport = imports.find((i) => i.namespaceImport === "GObject");
                expect(gobjectImport).toBeDefined();
            });

            it("adds parent namespace for cross-namespace inheritance", () => {
                const { builder } = createTestSetup({
                    namespace: "Adw",
                    parentClassName: "Widget",
                    parentOriginalName: "Widget",
                    parentNamespace: "Gtk",
                });

                const imports = builder.collectImports();

                const gtkImport = imports.find((i) => i.namespaceImport === "Gtk");
                expect(gtkImport).toBeDefined();
            });

            it("sorts external namespace imports", () => {
                const { ctx, builder } = createTestSetup({ namespace: "Gtk" });
                ctx.usedExternalTypes.set("Gio.File", {
                    namespace: "Gio",
                    name: "File",
                    transformedName: "File",
                    kind: "class",
                });
                ctx.usedExternalTypes.set("Gdk.Rectangle", {
                    namespace: "Gdk",
                    name: "Rectangle",
                    transformedName: "Rectangle",
                    kind: "record",
                });
                ctx.usedExternalTypes.set("GLib.Variant", {
                    namespace: "GLib",
                    name: "Variant",
                    transformedName: "Variant",
                    kind: "record",
                });

                const imports = builder.collectImports();

                const nsImports = imports.filter((i) => i.namespaceImport);
                const namespaces = nsImports.map((i) => i.namespaceImport);
                expect(namespaces).toEqual(["GLib", "Gdk", "Gio"]);
            });
        });
    });

    describe("applyToSourceFile", () => {
        it("applies imports to source file", () => {
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");

            const { ctx, builder } = createTestSetup();
            ctx.usesCall = true;
            ctx.usedEnums.add("Orientation");

            builder.applyToSourceFile(sourceFile);

            const imports = sourceFile.getImportDeclarations();
            expect(imports.length).toBeGreaterThan(0);
        });

        it("handles empty imports gracefully", () => {
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");

            const { builder } = createTestSetup();

            expect(() => builder.applyToSourceFile(sourceFile)).not.toThrow();
            expect(sourceFile.getImportDeclarations()).toHaveLength(0);
        });

        it("creates namespace imports correctly", () => {
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");

            const { ctx, builder } = createTestSetup({ namespace: "Gtk" });
            ctx.usedExternalTypes.set("Gdk.Rectangle", {
                namespace: "Gdk",
                name: "Rectangle",
                transformedName: "Rectangle",
                kind: "record",
            });

            builder.applyToSourceFile(sourceFile);

            const imports = sourceFile.getImportDeclarations();
            const gdkImport = imports.find((i) => i.getNamespaceImport()?.getText() === "Gdk");
            expect(gdkImport).toBeDefined();
        });

        it("creates type-only imports correctly", () => {
            const project = createTestProject();
            const sourceFile = createTestSourceFile(project, "test.ts");

            const { ctx, builder } = createTestSetup();
            ctx.usesRuntimeWidgetMeta = true;

            builder.applyToSourceFile(sourceFile);

            const imports = sourceFile.getImportDeclarations();
            const typeImport = imports.find((i) =>
                i.getNamedImports().some((n) => n.getName() === "RuntimeWidgetMeta" && n.isTypeOnly()),
            );
            expect(typeImport).toBeDefined();
        });
    });
});
