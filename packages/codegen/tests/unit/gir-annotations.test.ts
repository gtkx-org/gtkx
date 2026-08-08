import { describe, expect, it } from "vitest";
import type { GirClass, GirVirtualMethod } from "../../src/gir/class.js";
import type { GirField } from "../../src/gir/field.js";
import type { GirFunction } from "../../src/gir/function.js";
import type { GirProperty } from "../../src/gir/property.js";
import { Library } from "../../src/gir/library.js";

const library = Library.load(["Gtk-4.0"], ["/usr/share/gir-1.0"]);

const typeIn = (namespaceName: string, typeName: string): GirClass => {
    const namespace = library.namespaces.get(namespaceName);

    const found = [...(namespace?.classes ?? []), ...(namespace?.interfaces ?? [])].find(
        (candidate) => candidate.name === typeName,
    );

    if (found === undefined) {
        throw new Error(`No class or interface ${namespaceName}.${typeName}`);
    }

    return found;
};

const methodIn = (namespaceName: string, typeName: string, methodName: string): GirFunction => {
    const found = typeIn(namespaceName, typeName).methods.find((method) => method.name === methodName);

    if (found === undefined) {
        throw new Error(`No method ${namespaceName}.${typeName}.${methodName}`);
    }

    return found;
};

const propertyIn = (namespaceName: string, typeName: string, propertyName: string): GirProperty => {
    const found = typeIn(namespaceName, typeName).properties.find((property) => property.name === propertyName);

    if (found === undefined) {
        throw new Error(`No property ${namespaceName}.${typeName}:${propertyName}`);
    }

    return found;
};

const vfuncIn = (namespaceName: string, typeName: string, vfuncName: string): GirVirtualMethod => {
    const found = typeIn(namespaceName, typeName).vfuncs.find((vfunc) => vfunc.name === vfuncName);

    if (found === undefined) {
        throw new Error(`No virtual method ${namespaceName}.${typeName}.${vfuncName}`);
    }

    return found;
};

const vtableFieldIn = (namespaceName: string, recordName: string, fieldName: string): GirField => {
    const record = library.namespaces.get(namespaceName)?.records.find((candidate) => candidate.name === recordName);
    const found = record?.fields.find((field) => field.name === fieldName);

    if (found === undefined) {
        throw new Error(`No field ${namespaceName}.${recordName}.${fieldName}`);
    }

    return found;
};

const parameterDocs = (fn: GirFunction): Map<string, string | undefined> =>
    new Map(fn.parameters.map((parameter) => [parameter.name, parameter.doc]));

describe("deprecation annotations", () => {
    it("reads the deprecation flag, version, and prose off a method", () => {
        const { annotations } = methodIn("Gtk", "Widget", "show");
        expect(annotations.isDeprecated).toBe(true);
        expect(annotations.deprecatedSince).toBe("4.10");
        expect(annotations.deprecationDoc).toContain("Use [method@Gtk.Widget.set_visible] instead");
    });

    it("reads deprecation off a property", () => {
        const { annotations } = propertyIn("Gtk", "Application", "register-session");
        expect(annotations.isDeprecated).toBe(true);
        expect(annotations.deprecationDoc).toBeDefined();
        expect(annotations.deprecationDoc).not.toBe("");
    });

    it("reads deprecation off a class", () => {
        const { annotations } = typeIn("Gtk", "Assistant");
        expect(annotations.isDeprecated).toBe(true);
        expect(annotations.deprecatedSince).toBe("4.10");
    });
});

describe("version annotations", () => {
    it("reads the introducing release off a method", () => {
        const launchFinish = methodIn("Gtk", "FileLauncher", "launch_finish");
        expect(launchFinish.annotations.since).toBe("4.10");
        expect(launchFinish.throws).toBe(true);
    });
});

describe("parameter and return documentation", () => {
    it("carries a doc on every parameter of a measured signature", () => {
        const measure = methodIn("Gtk", "Widget", "measure");
        const docs = parameterDocs(measure);
        const names = ["orientation", "for_size", "minimum", "natural", "minimum_baseline", "natural_baseline"];

        for (const name of names) {
            expect(docs.get(name)).toBeTypeOf("string");
        }

        expect(measure.instance?.doc).toBe("A `GtkWidget` instance");
    });

    it("carries a doc on the return value and the instance parameter", () => {
        const firstChild = methodIn("Gtk", "Widget", "get_first_child");
        expect(firstChild.returnValue.doc).toContain("first child");
        expect(firstChild.instance?.doc).toBe("a widget");
    });
});

describe("virtual methods", () => {
    it("keeps the interface vfunc documentation, which is richer than the vtable field's", () => {
        const vfunc = vfuncIn("Gio", "ListModel", "get_n_items");
        const field = vtableFieldIn("Gio", "ListModelInterface", "get_n_items");
        expect(vfunc.invoker).toBe("get_n_items");
        expect(vfunc.doc?.startsWith("Gets the number of items")).toBe(true);
        expect(field.doc).toBe("the virtual function pointer for g_list_model_get_n_items()");
    });

    it("keeps a class vfunc documentation the vtable field lacks entirely", () => {
        const vfunc = vfuncIn("Gtk", "Window", "close_request");
        const field = vtableFieldIn("Gtk", "WindowClass", "close_request");
        expect(vfunc.doc).toBe("Class handler for the [signal@Window::close-request] signal.");
        expect(field.doc).toBeUndefined();
    });
});
