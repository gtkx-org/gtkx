import { describe, expect, it } from "vitest";
import {
    NormalizedEnumeration,
    NormalizedEnumerationMember,
    NormalizedField,
    NormalizedMethod,
    NormalizedParameter,
    NormalizedProperty,
    NormalizedRecord,
    NormalizedSignal,
    NormalizedType,
    parseQualifiedName,
    type QualifiedName,
    qualifiedName,
} from "../src/types.js";

describe("qualifiedName", () => {
    it("creates a QualifiedName from namespace and name", () => {
        const qn = qualifiedName("Gtk", "Button");
        expect(qn).toBe("Gtk.Button");
    });

    it("handles various namespace combinations", () => {
        expect(qualifiedName("GLib", "Variant")).toBe("GLib.Variant");
        expect(qualifiedName("GObject", "Object")).toBe("GObject.Object");
        expect(qualifiedName("Gio", "File")).toBe("Gio.File");
    });

    it("handles names with special characters", () => {
        expect(qualifiedName("Gtk", "Widget")).toBe("Gtk.Widget");
    });
});

describe("parseQualifiedName", () => {
    it("parses a QualifiedName into namespace and name", () => {
        const result = parseQualifiedName("Gtk.Button" as QualifiedName);
        expect(result.namespace).toBe("Gtk");
        expect(result.name).toBe("Button");
    });

    it("handles various qualified names", () => {
        const result1 = parseQualifiedName("GLib.Variant" as QualifiedName);
        expect(result1.namespace).toBe("GLib");
        expect(result1.name).toBe("Variant");

        const result2 = parseQualifiedName("GObject.Object" as QualifiedName);
        expect(result2.namespace).toBe("GObject");
        expect(result2.name).toBe("Object");
    });

    it("handles names with dots in the name part", () => {
        const result = parseQualifiedName("Gtk.Widget.Class" as QualifiedName);
        expect(result.namespace).toBe("Gtk");
        expect(result.name).toBe("Widget.Class");
    });
});

describe("NormalizedType", () => {
    it("identifies intrinsic types", () => {
        const type = new NormalizedType({
            name: "gint",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isIntrinsic()).toBe(true);
        expect(type.isNumeric()).toBe(true);
    });

    it("identifies string types", () => {
        const type = new NormalizedType({
            name: "utf8",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isString()).toBe(true);
    });

    it("identifies boolean types", () => {
        const type = new NormalizedType({
            name: "gboolean",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isBoolean()).toBe(true);
    });

    it("identifies void types", () => {
        const type = new NormalizedType({
            name: "none",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isVoid()).toBe(true);
    });

    it("identifies GVariant types", () => {
        const type = new NormalizedType({
            name: "GVariant",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isVariant()).toBe(true);
    });

    it("identifies GParamSpec types", () => {
        const type = new NormalizedType({
            name: "GParamSpec",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.isParamSpec()).toBe(true);
    });

    it("gets namespace from qualified names", () => {
        const type = new NormalizedType({
            name: "Gtk.Widget" as QualifiedName,
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.getNamespace()).toBe("Gtk");
    });

    it("returns null namespace for intrinsic types", () => {
        const type = new NormalizedType({
            name: "gint",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.getNamespace()).toBeNull();
    });

    it("gets simple name from qualified names", () => {
        const type = new NormalizedType({
            name: "Gtk.Widget" as QualifiedName,
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.getSimpleName()).toBe("Widget");
    });

    it("gets simple name for intrinsic types", () => {
        const type = new NormalizedType({
            name: "gint",
            isArray: false,
            elementType: null,
            nullable: false,
        });
        expect(type.getSimpleName()).toBe("gint");
    });
});

describe("NormalizedEnumeration", () => {
    const createEnum = () =>
        new NormalizedEnumeration({
            name: "Align",
            qualifiedName: "Gtk.Align" as QualifiedName,
            cType: "GtkAlign",
            members: [
                new NormalizedEnumerationMember({ name: "fill", value: "0", cIdentifier: "GTK_ALIGN_FILL" }),
                new NormalizedEnumerationMember({ name: "start", value: "1", cIdentifier: "GTK_ALIGN_START" }),
                new NormalizedEnumerationMember({ name: "end", value: "2", cIdentifier: "GTK_ALIGN_END" }),
            ],
        });

    it("finds member by name", () => {
        const enumType = createEnum();
        const member = enumType.getMember("start");
        expect(member).toBeDefined();
        expect(member?.value).toBe("1");
    });

    it("finds member by value", () => {
        const enumType = createEnum();
        const member = enumType.getMemberByValue("2");
        expect(member).toBeDefined();
        expect(member?.name).toBe("end");
    });

    it("gets all member names", () => {
        const enumType = createEnum();
        expect(enumType.getMemberNames()).toEqual(["fill", "start", "end"]);
    });

    it("returns null for non-existent member", () => {
        const enumType = createEnum();
        expect(enumType.getMember("nonexistent")).toBeNull();
    });
});

describe("NormalizedRecord", () => {
    const createRecord = (options: Partial<ConstructorParameters<typeof NormalizedRecord>[0]> = {}) =>
        new NormalizedRecord({
            name: "Rectangle",
            qualifiedName: "Gdk.Rectangle" as QualifiedName,
            cType: "GdkRectangle",
            opaque: false,
            disguised: false,
            fields: [
                new NormalizedField({
                    name: "x",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    writable: true,
                    readable: true,
                    private: false,
                }),
                new NormalizedField({
                    name: "y",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    writable: true,
                    readable: true,
                    private: false,
                }),
                new NormalizedField({
                    name: "_priv",
                    type: new NormalizedType({ name: "gpointer", isArray: false, elementType: null, nullable: false }),
                    writable: false,
                    readable: false,
                    private: true,
                }),
            ],
            methods: [],
            constructors: [],
            staticFunctions: [],
            ...options,
        });

    it("identifies boxed types", () => {
        const record = createRecord({ glibTypeName: "GdkRectangle" });
        expect(record.isBoxed()).toBe(true);
    });

    it("identifies non-boxed types", () => {
        const record = createRecord();
        expect(record.isBoxed()).toBe(false);
    });

    it("identifies GType structs", () => {
        const record = createRecord({ isGtypeStructFor: "GtkWidget" });
        expect(record.isGtypeStruct()).toBe(true);
    });

    it("identifies plain structs", () => {
        const record = createRecord();
        expect(record.isPlainStruct()).toBe(true);
    });

    it("gets public fields only", () => {
        const record = createRecord();
        const publicFields = record.getPublicFields();
        expect(publicFields).toHaveLength(2);
        expect(publicFields.map((f) => f.name)).toEqual(["x", "y"]);
    });

    it("finds field by name", () => {
        const record = createRecord();
        const field = record.getField("x");
        expect(field).toBeDefined();
        expect(field?.name).toBe("x");
    });
});

describe("NormalizedMethod", () => {
    const createMethod = (options: Partial<ConstructorParameters<typeof NormalizedMethod>[0]> = {}) =>
        new NormalizedMethod({
            name: "get_name",
            cIdentifier: "gtk_widget_get_name",
            returnType: new NormalizedType({
                name: "utf8",
                isArray: false,
                elementType: null,
                nullable: false,
            }),
            parameters: [],
            throws: false,
            ...options,
        });

    it("identifies async methods by name suffix", () => {
        const method = createMethod({ name: "load_async" });
        expect(method.isAsync()).toBe(true);
    });

    it("identifies async finish methods", () => {
        const method = createMethod({ name: "load_finish" });
        expect(method.isAsyncFinish()).toBe(true);
    });

    it("gets finish method name for async methods", () => {
        const method = createMethod({ name: "load_async" });
        expect(method.getFinishMethodName()).toBe("load_finish");
    });

    it("returns null finish name for non-async methods", () => {
        const method = createMethod({ name: "get_name" });
        expect(method.getFinishMethodName()).toBeNull();
    });

    it("identifies methods with out parameters", () => {
        const method = createMethod({
            parameters: [
                new NormalizedParameter({
                    name: "result",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    direction: "out",
                    callerAllocates: false,
                    nullable: false,
                    optional: false,
                }),
            ],
        });
        expect(method.hasOutParameters()).toBe(true);
    });

    it("gets out parameters only", () => {
        const method = createMethod({
            parameters: [
                new NormalizedParameter({
                    name: "input",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    direction: "in",
                    callerAllocates: false,
                    nullable: false,
                    optional: false,
                }),
                new NormalizedParameter({
                    name: "output",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    direction: "out",
                    callerAllocates: false,
                    nullable: false,
                    optional: false,
                }),
            ],
        });
        const outParams = method.getOutParameters();
        expect(outParams).toHaveLength(1);
        expect(outParams[0].name).toBe("output");
    });

    it("gets required parameters", () => {
        const method = createMethod({
            parameters: [
                new NormalizedParameter({
                    name: "required",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    direction: "in",
                    callerAllocates: false,
                    nullable: false,
                    optional: false,
                }),
                new NormalizedParameter({
                    name: "optional",
                    type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
                    direction: "in",
                    callerAllocates: false,
                    nullable: false,
                    optional: true,
                }),
            ],
        });
        const requiredParams = method.getRequiredParameters();
        expect(requiredParams).toHaveLength(1);
        expect(requiredParams[0].name).toBe("required");
    });
});

describe("NormalizedParameter", () => {
    const createParam = (options: Partial<ConstructorParameters<typeof NormalizedParameter>[0]> = {}) =>
        new NormalizedParameter({
            name: "param",
            type: new NormalizedType({ name: "gint", isArray: false, elementType: null, nullable: false }),
            direction: "in",
            callerAllocates: false,
            nullable: false,
            optional: false,
            ...options,
        });

    it("identifies input parameters", () => {
        const param = createParam({ direction: "in" });
        expect(param.isIn()).toBe(true);
        expect(param.isOut()).toBe(false);
    });

    it("identifies output parameters", () => {
        const param = createParam({ direction: "out" });
        expect(param.isIn()).toBe(false);
        expect(param.isOut()).toBe(true);
    });

    it("identifies inout parameters as output", () => {
        const param = createParam({ direction: "inout" });
        expect(param.isOut()).toBe(true);
    });

    it("identifies callback parameters", () => {
        const param = createParam({ scope: "async" });
        expect(param.isCallback()).toBe(true);
    });

    it("identifies closure data parameters", () => {
        const param = createParam({ closure: 1 });
        expect(param.isClosureData()).toBe(true);
    });

    it("identifies destroy notify parameters", () => {
        const param = createParam({ destroy: 2 });
        expect(param.isDestroyNotify()).toBe(true);
    });

    it("identifies caller-allocates parameters", () => {
        const param = createParam({ direction: "out", callerAllocates: true });
        expect(param.requiresCallerAllocation()).toBe(true);
    });
});

describe("NormalizedProperty", () => {
    const createProperty = (options: Partial<ConstructorParameters<typeof NormalizedProperty>[0]> = {}) =>
        new NormalizedProperty({
            name: "visible",
            type: new NormalizedType({ name: "gboolean", isArray: false, elementType: null, nullable: false }),
            readable: true,
            writable: true,
            constructOnly: false,
            hasDefault: false,
            ...options,
        });

    it("identifies read-only properties", () => {
        const prop = createProperty({ readable: true, writable: false });
        expect(prop.isReadOnly()).toBe(true);
        expect(prop.isWriteOnly()).toBe(false);
    });

    it("identifies write-only properties", () => {
        const prop = createProperty({ readable: false, writable: true });
        expect(prop.isReadOnly()).toBe(false);
        expect(prop.isWriteOnly()).toBe(true);
    });

    it("identifies construct-only properties", () => {
        const prop = createProperty({ constructOnly: true });
        expect(prop.isConstructOnly()).toBe(true);
    });

    it("identifies properties with accessors", () => {
        const prop = createProperty({ getter: "get_visible", setter: "set_visible" });
        expect(prop.hasAccessors()).toBe(true);
    });

    it("identifies properties without full accessors", () => {
        const prop = createProperty({ getter: "get_visible" });
        expect(prop.hasAccessors()).toBe(false);
    });
});

describe("NormalizedSignal", () => {
    it("identifies signals with return values", () => {
        const signal = new NormalizedSignal({
            name: "clicked",
            when: "first",
            returnType: new NormalizedType({
                name: "gboolean",
                isArray: false,
                elementType: null,
                nullable: false,
            }),
            parameters: [],
        });
        expect(signal.hasReturnValue()).toBe(true);
    });

    it("identifies signals without return values", () => {
        const signal = new NormalizedSignal({
            name: "clicked",
            when: "first",
            returnType: new NormalizedType({
                name: "none",
                isArray: false,
                elementType: null,
                nullable: false,
            }),
            parameters: [],
        });
        expect(signal.hasReturnValue()).toBe(false);
    });

    it("handles null return type", () => {
        const signal = new NormalizedSignal({
            name: "clicked",
            when: "first",
            returnType: null,
            parameters: [],
        });
        expect(signal.hasReturnValue()).toBe(false);
    });
});
