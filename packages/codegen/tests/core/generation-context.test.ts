import { describe, expect, it } from "vitest";
import { GenerationContext } from "../../src/core/generation-context.js";
import type { TypeImport } from "../../src/core/type-system/ffi-types.js";

describe("GenerationContext", () => {
    describe("initial state", () => {
        it("initializes with all flags false", () => {
            const ctx = new GenerationContext();

            expect(ctx.usesRef).toBe(false);
            expect(ctx.usesCall).toBe(false);
            expect(ctx.usesInstantiating).toBe(false);
            expect(ctx.addGioImport).toBe(false);
            expect(ctx.usesType).toBe(false);
            expect(ctx.usesRead).toBe(false);
            expect(ctx.usesWrite).toBe(false);
            expect(ctx.usesAlloc).toBe(false);
            expect(ctx.usesNativeError).toBe(false);
            expect(ctx.usesNativeObject).toBe(false);
            expect(ctx.usesGetNativeObject).toBe(false);
            expect(ctx.usesRegisterNativeClass).toBe(false);
            expect(ctx.usesGetClassByTypeName).toBe(false);
            expect(ctx.usesResolveSignalMeta).toBe(false);
            expect(ctx.usesRuntimeWidgetMeta).toBe(false);
            expect(ctx.usesGObjectNamespace).toBe(false);
        });

        it("initializes with empty collections", () => {
            const ctx = new GenerationContext();

            expect(ctx.usedEnums.size).toBe(0);
            expect(ctx.usedRecords.size).toBe(0);
            expect(ctx.usedExternalTypes.size).toBe(0);
            expect(ctx.usedSameNamespaceClasses.size).toBe(0);
            expect(ctx.usedInterfaces.size).toBe(0);
            expect(ctx.signalClasses.size).toBe(0);
            expect(ctx.methodRenames.size).toBe(0);
        });
    });

    describe("flag setting", () => {
        it("allows setting boolean flags", () => {
            const ctx = new GenerationContext();

            ctx.usesRef = true;
            ctx.usesCall = true;
            ctx.usesInstantiating = true;

            expect(ctx.usesRef).toBe(true);
            expect(ctx.usesCall).toBe(true);
            expect(ctx.usesInstantiating).toBe(true);
        });

        it("allows setting import flags", () => {
            const ctx = new GenerationContext();

            ctx.addGioImport = true;
            ctx.usesGObjectNamespace = true;

            expect(ctx.addGioImport).toBe(true);
            expect(ctx.usesGObjectNamespace).toBe(true);
        });

        it("allows setting function usage flags", () => {
            const ctx = new GenerationContext();

            ctx.usesRead = true;
            ctx.usesWrite = true;
            ctx.usesAlloc = true;

            expect(ctx.usesRead).toBe(true);
            expect(ctx.usesWrite).toBe(true);
            expect(ctx.usesAlloc).toBe(true);
        });
    });

    describe("collection management", () => {
        it("tracks used enums", () => {
            const ctx = new GenerationContext();

            ctx.usedEnums.add("Orientation");
            ctx.usedEnums.add("Align");

            expect(ctx.usedEnums.has("Orientation")).toBe(true);
            expect(ctx.usedEnums.has("Align")).toBe(true);
            expect(ctx.usedEnums.size).toBe(2);
        });

        it("tracks used records", () => {
            const ctx = new GenerationContext();

            ctx.usedRecords.add("Rectangle");
            ctx.usedRecords.add("Color");

            expect(ctx.usedRecords.has("Rectangle")).toBe(true);
            expect(ctx.usedRecords.has("Color")).toBe(true);
        });

        it("tracks same-namespace classes", () => {
            const ctx = new GenerationContext();

            ctx.usedSameNamespaceClasses.set("Button", "Button");
            ctx.usedSameNamespaceClasses.set("Window", "Window");

            expect(ctx.usedSameNamespaceClasses.get("Button")).toBe("Button");
            expect(ctx.usedSameNamespaceClasses.get("Window")).toBe("Window");
        });

        it("tracks interfaces", () => {
            const ctx = new GenerationContext();

            ctx.usedInterfaces.set("Orientable", "Orientable");
            ctx.usedInterfaces.set("Actionable", "Actionable");

            expect(ctx.usedInterfaces.get("Orientable")).toBe("Orientable");
            expect(ctx.usedInterfaces.get("Actionable")).toBe("Actionable");
        });

        it("tracks signal classes", () => {
            const ctx = new GenerationContext();

            ctx.signalClasses.set("Widget", "Widget");
            ctx.signalClasses.set("Button", "Button");

            expect(ctx.signalClasses.get("Widget")).toBe("Widget");
        });

        it("tracks method renames", () => {
            const ctx = new GenerationContext();

            ctx.methodRenames.set("class", "klass");
            ctx.methodRenames.set("function", "func");

            expect(ctx.methodRenames.get("class")).toBe("klass");
            expect(ctx.methodRenames.get("function")).toBe("func");
        });

        it("tracks record name to file mappings", () => {
            const ctx = new GenerationContext();

            ctx.recordNameToFile.set("Rectangle", "rectangle.js");
            ctx.recordNameToFile.set("RGBA", "rgba.js");

            expect(ctx.recordNameToFile.get("Rectangle")).toBe("rectangle.js");
        });
    });

    describe("addTypeImports", () => {
        it("adds external enum to usedExternalTypes", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "enum",
                    name: "Orientation",
                    namespace: "Gtk",
                    transformedName: "Orientation",
                    isExternal: true,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedExternalTypes.has("Gtk.Orientation")).toBe(true);
            expect(ctx.usedExternalTypes.get("Gtk.Orientation")).toMatchObject({
                namespace: "Gtk",
                name: "Orientation",
                transformedName: "Orientation",
                kind: "enum",
            });
        });

        it("adds same-namespace enum to usedEnums", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "enum",
                    name: "Orientation",
                    namespace: "Gtk",
                    transformedName: "Orientation",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedEnums.has("Orientation")).toBe(true);
        });

        it("adds same-namespace flags to usedEnums", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "flags",
                    name: "StateFlags",
                    namespace: "Gtk",
                    transformedName: "StateFlags",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedEnums.has("StateFlags")).toBe(true);
        });

        it("adds same-namespace record to usedRecords", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "record",
                    name: "Rectangle",
                    namespace: "Gdk",
                    transformedName: "Rectangle",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedRecords.has("Rectangle")).toBe(true);
        });

        it("adds same-namespace class to usedSameNamespaceClasses", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "class",
                    name: "Button",
                    namespace: "Gtk",
                    transformedName: "Button",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedSameNamespaceClasses.has("Button")).toBe(true);
            expect(ctx.usedSameNamespaceClasses.get("Button")).toBe("Button");
        });

        it("adds same-namespace interface to usedInterfaces", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "interface",
                    name: "Orientable",
                    namespace: "Gtk",
                    transformedName: "Orientable",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedInterfaces.has("Orientable")).toBe(true);
            expect(ctx.usedInterfaces.get("Orientable")).toBe("Orientable");
        });

        it("ignores callback imports for same namespace", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "callback",
                    name: "AsyncReadyCallback",
                    namespace: "Gio",
                    transformedName: "AsyncReadyCallback",
                    isExternal: false,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedEnums.size).toBe(0);
            expect(ctx.usedRecords.size).toBe(0);
            expect(ctx.usedSameNamespaceClasses.size).toBe(0);
            expect(ctx.usedInterfaces.size).toBe(0);
        });

        it("handles multiple imports at once", () => {
            const ctx = new GenerationContext();
            const imports: TypeImport[] = [
                {
                    kind: "class",
                    name: "Button",
                    namespace: "Gtk",
                    transformedName: "Button",
                    isExternal: false,
                },
                {
                    kind: "enum",
                    name: "Orientation",
                    namespace: "Gtk",
                    transformedName: "Orientation",
                    isExternal: false,
                },
                {
                    kind: "class",
                    name: "Application",
                    namespace: "Gio",
                    transformedName: "Application",
                    isExternal: true,
                },
            ];

            ctx.addTypeImports(imports);

            expect(ctx.usedSameNamespaceClasses.has("Button")).toBe(true);
            expect(ctx.usedEnums.has("Orientation")).toBe(true);
            expect(ctx.usedExternalTypes.has("Gio.Application")).toBe(true);
        });

        it("handles empty imports array", () => {
            const ctx = new GenerationContext();

            ctx.addTypeImports([]);

            expect(ctx.usedEnums.size).toBe(0);
            expect(ctx.usedExternalTypes.size).toBe(0);
        });
    });

    describe("reset", () => {
        it("resets all boolean flags to false", () => {
            const ctx = new GenerationContext();

            ctx.usesRef = true;
            ctx.usesCall = true;
            ctx.usesInstantiating = true;
            ctx.addGioImport = true;
            ctx.usesType = true;
            ctx.usesRead = true;
            ctx.usesWrite = true;
            ctx.usesAlloc = true;
            ctx.usesNativeError = true;
            ctx.usesNativeObject = true;
            ctx.usesGetNativeObject = true;
            ctx.usesRegisterNativeClass = true;
            ctx.usesGetClassByTypeName = true;
            ctx.usesResolveSignalMeta = true;
            ctx.usesRuntimeWidgetMeta = true;
            ctx.usesGObjectNamespace = true;

            ctx.reset();

            expect(ctx.usesRef).toBe(false);
            expect(ctx.usesCall).toBe(false);
            expect(ctx.usesInstantiating).toBe(false);
            expect(ctx.addGioImport).toBe(false);
            expect(ctx.usesType).toBe(false);
            expect(ctx.usesRead).toBe(false);
            expect(ctx.usesWrite).toBe(false);
            expect(ctx.usesAlloc).toBe(false);
            expect(ctx.usesNativeError).toBe(false);
            expect(ctx.usesNativeObject).toBe(false);
            expect(ctx.usesGetNativeObject).toBe(false);
            expect(ctx.usesRegisterNativeClass).toBe(false);
            expect(ctx.usesGetClassByTypeName).toBe(false);
            expect(ctx.usesResolveSignalMeta).toBe(false);
            expect(ctx.usesRuntimeWidgetMeta).toBe(false);
            expect(ctx.usesGObjectNamespace).toBe(false);
        });

        it("clears all collection sets and maps", () => {
            const ctx = new GenerationContext();

            ctx.usedEnums.add("Orientation");
            ctx.usedRecords.add("Rectangle");
            ctx.usedExternalTypes.set("Gdk.Rectangle", {
                namespace: "Gdk",
                name: "Rectangle",
                transformedName: "Rectangle",
                kind: "record",
            });
            ctx.usedSameNamespaceClasses.set("Button", "Button");
            ctx.usedInterfaces.set("Orientable", "Orientable");
            ctx.signalClasses.set("Widget", "Widget");
            ctx.methodRenames.set("class", "klass");

            ctx.reset();

            expect(ctx.usedEnums.size).toBe(0);
            expect(ctx.usedRecords.size).toBe(0);
            expect(ctx.usedExternalTypes.size).toBe(0);
            expect(ctx.usedSameNamespaceClasses.size).toBe(0);
            expect(ctx.usedInterfaces.size).toBe(0);
            expect(ctx.signalClasses.size).toBe(0);
            expect(ctx.methodRenames.size).toBe(0);
        });

        it("does not clear recordNameToFile and interfaceNameToFile", () => {
            const ctx = new GenerationContext();

            ctx.recordNameToFile.set("Rectangle", "rectangle.js");
            ctx.interfaceNameToFile.set("Orientable", "orientable.js");

            ctx.reset();

            expect(ctx.recordNameToFile.get("Rectangle")).toBe("rectangle.js");
            expect(ctx.interfaceNameToFile.get("Orientable")).toBe("orientable.js");
        });

        it("allows reuse after reset", () => {
            const ctx = new GenerationContext();

            ctx.usesCall = true;
            ctx.usedEnums.add("Orientation");
            ctx.reset();

            ctx.usesRef = true;
            ctx.usedRecords.add("Rectangle");

            expect(ctx.usesRef).toBe(true);
            expect(ctx.usesCall).toBe(false);
            expect(ctx.usedRecords.has("Rectangle")).toBe(true);
            expect(ctx.usedEnums.has("Orientation")).toBe(false);
        });
    });
});
