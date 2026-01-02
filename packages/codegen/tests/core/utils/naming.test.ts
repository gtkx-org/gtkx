import { describe, expect, it } from "vitest";
import { filterSupportedMethods, isMethodDuplicate } from "../../../src/core/utils/filtering.js";
import {
    CLASS_RENAMES,
    generateConflictingMethodName,
    kebabToSnake,
    normalizeClassName,
    snakeToKebab,
    toCamelCase,
    toConstantCase,
    toKebabCase,
    toPascalCase,
    toValidIdentifier,
} from "../../../src/core/utils/naming.js";

describe("toCamelCase", () => {
    it("converts kebab-case to camelCase", () => {
        expect(toCamelCase("get-name")).toBe("getName");
        expect(toCamelCase("set-visible")).toBe("setVisible");
        expect(toCamelCase("my-long-property-name")).toBe("myLongPropertyName");
    });

    it("converts snake_case to camelCase", () => {
        expect(toCamelCase("get_name")).toBe("getName");
        expect(toCamelCase("set_visible")).toBe("setVisible");
    });

    it("handles single-word input", () => {
        expect(toCamelCase("name")).toBe("name");
    });

    it("handles empty string", () => {
        expect(toCamelCase("")).toBe("");
    });
});

describe("toPascalCase", () => {
    it("converts kebab-case to PascalCase", () => {
        expect(toPascalCase("get-name")).toBe("GetName");
        expect(toPascalCase("my-widget")).toBe("MyWidget");
    });

    it("converts snake_case to PascalCase", () => {
        expect(toPascalCase("get_name")).toBe("GetName");
    });

    it("capitalizes first letter of single word", () => {
        expect(toPascalCase("widget")).toBe("Widget");
    });

    it("handles empty string", () => {
        expect(toPascalCase("")).toBe("");
    });
});

describe("toKebabCase", () => {
    it("converts camelCase to kebab-case", () => {
        expect(toKebabCase("getName")).toBe("get-name");
        expect(toKebabCase("setVisible")).toBe("set-visible");
    });

    it("converts PascalCase to kebab-case", () => {
        expect(toKebabCase("MyWidget")).toBe("my-widget");
    });

    it("converts snake_case to kebab-case", () => {
        expect(toKebabCase("get_name")).toBe("get-name");
    });

    it("handles single word", () => {
        expect(toKebabCase("widget")).toBe("widget");
    });

    it("handles consecutive uppercase", () => {
        expect(toKebabCase("getHTTPResponse")).toBe("get-http-response");
    });

    it("handles all uppercase", () => {
        expect(toKebabCase("HTTP")).toBe("http");
    });

    it("handles multiple acronyms", () => {
        expect(toKebabCase("XMLHTTPRequest")).toBe("xmlhttp-request");
    });

    it("handles trailing acronym", () => {
        expect(toKebabCase("getHTTP")).toBe("get-http");
    });

    it("handles empty string", () => {
        expect(toKebabCase("")).toBe("");
    });
});

describe("toConstantCase", () => {
    it("converts kebab-case to CONSTANT_CASE", () => {
        expect(toConstantCase("get-name")).toBe("GET_NAME");
        expect(toConstantCase("my-constant")).toBe("MY_CONSTANT");
    });

    it("handles single word", () => {
        expect(toConstantCase("name")).toBe("NAME");
    });

    it("handles empty string", () => {
        expect(toConstantCase("")).toBe("");
    });
});

describe("kebabToSnake", () => {
    it("converts kebab-case to snake_case", () => {
        expect(kebabToSnake("get-name")).toBe("get_name");
        expect(kebabToSnake("my-property")).toBe("my_property");
    });

    it("handles string without hyphens", () => {
        expect(kebabToSnake("name")).toBe("name");
    });

    it("handles empty string", () => {
        expect(kebabToSnake("")).toBe("");
    });
});

describe("snakeToKebab", () => {
    it("converts snake_case to kebab-case", () => {
        expect(snakeToKebab("get_name")).toBe("get-name");
        expect(snakeToKebab("my_property")).toBe("my-property");
    });

    it("handles string without underscores", () => {
        expect(snakeToKebab("name")).toBe("name");
    });

    it("handles empty string", () => {
        expect(snakeToKebab("")).toBe("");
    });
});

describe("toValidIdentifier", () => {
    it("replaces invalid characters with underscores", () => {
        expect(toValidIdentifier("my-name")).toBe("my_name");
        expect(toValidIdentifier("my.property")).toBe("my_property");
        expect(toValidIdentifier("my@special#chars")).toBe("my_special_chars");
    });

    it("suffixes reserved words with underscore", () => {
        expect(toValidIdentifier("class")).toBe("class_");
        expect(toValidIdentifier("function")).toBe("function_");
        expect(toValidIdentifier("export")).toBe("export_");
        expect(toValidIdentifier("import")).toBe("import_");
        expect(toValidIdentifier("const")).toBe("const_");
        expect(toValidIdentifier("let")).toBe("let_");
        expect(toValidIdentifier("var")).toBe("var_");
        expect(toValidIdentifier("return")).toBe("return_");
        expect(toValidIdentifier("if")).toBe("if_");
        expect(toValidIdentifier("else")).toBe("else_");
        expect(toValidIdentifier("while")).toBe("while_");
        expect(toValidIdentifier("for")).toBe("for_");
        expect(toValidIdentifier("break")).toBe("break_");
        expect(toValidIdentifier("continue")).toBe("continue_");
        expect(toValidIdentifier("switch")).toBe("switch_");
        expect(toValidIdentifier("case")).toBe("case_");
        expect(toValidIdentifier("default")).toBe("default_");
        expect(toValidIdentifier("try")).toBe("try_");
        expect(toValidIdentifier("catch")).toBe("catch_");
        expect(toValidIdentifier("finally")).toBe("finally_");
        expect(toValidIdentifier("throw")).toBe("throw_");
        expect(toValidIdentifier("new")).toBe("new_");
        expect(toValidIdentifier("this")).toBe("this_");
        expect(toValidIdentifier("super")).toBe("super_");
        expect(toValidIdentifier("async")).toBe("async_");
        expect(toValidIdentifier("await")).toBe("await_");
        expect(toValidIdentifier("yield")).toBe("yield_");
        expect(toValidIdentifier("null")).toBe("null_");
        expect(toValidIdentifier("true")).toBe("true_");
        expect(toValidIdentifier("false")).toBe("false_");
        expect(toValidIdentifier("void")).toBe("void_");
        expect(toValidIdentifier("typeof")).toBe("typeof_");
        expect(toValidIdentifier("instanceof")).toBe("instanceof_");
        expect(toValidIdentifier("in")).toBe("in_");
        expect(toValidIdentifier("delete")).toBe("delete_");
        expect(toValidIdentifier("debugger")).toBe("debugger_");
        expect(toValidIdentifier("with")).toBe("with_");
        expect(toValidIdentifier("extends")).toBe("extends_");
        expect(toValidIdentifier("static")).toBe("static_");
        expect(toValidIdentifier("enum")).toBe("enum_");
        expect(toValidIdentifier("implements")).toBe("implements_");
        expect(toValidIdentifier("interface")).toBe("interface_");
        expect(toValidIdentifier("package")).toBe("package_");
        expect(toValidIdentifier("private")).toBe("private_");
        expect(toValidIdentifier("protected")).toBe("protected_");
        expect(toValidIdentifier("public")).toBe("public_");
        expect(toValidIdentifier("eval")).toBe("eval_");
        expect(toValidIdentifier("arguments")).toBe("arguments_");
    });

    it("prefixes identifiers starting with digit", () => {
        expect(toValidIdentifier("123abc")).toBe("_123abc");
        expect(toValidIdentifier("1")).toBe("_1");
    });

    it("allows valid identifiers unchanged", () => {
        expect(toValidIdentifier("myName")).toBe("myName");
        expect(toValidIdentifier("_private")).toBe("_private");
        expect(toValidIdentifier("$dollar")).toBe("$dollar");
        expect(toValidIdentifier("abc123")).toBe("abc123");
    });

    it("handles empty string", () => {
        expect(toValidIdentifier("")).toBe("");
    });
});

describe("isMethodDuplicate", () => {
    it("returns false for first occurrence", () => {
        const seen = new Set<string>();
        expect(isMethodDuplicate("get_name", "gtk_widget_get_name", seen)).toBe(false);
    });

    it("returns true for duplicate", () => {
        const seen = new Set<string>();
        isMethodDuplicate("get_name", "gtk_widget_get_name", seen);
        expect(isMethodDuplicate("get_name", "gtk_widget_get_name", seen)).toBe(true);
    });

    it("treats different C identifiers as different methods", () => {
        const seen = new Set<string>();
        isMethodDuplicate("get_name", "gtk_widget_get_name", seen);
        expect(isMethodDuplicate("get_name", "gtk_button_get_name", seen)).toBe(false);
    });

    it("normalizes name to camelCase for comparison", () => {
        const seen = new Set<string>();
        isMethodDuplicate("get_name", "gtk_widget_get_name", seen);
        expect(isMethodDuplicate("get-name", "gtk_widget_get_name", seen)).toBe(true);
    });
});

describe("filterSupportedMethods", () => {
    it("filters out duplicates", () => {
        const methods = [
            { name: "get_name", cIdentifier: "gtk_widget_get_name", parameters: [] },
            { name: "get_name", cIdentifier: "gtk_widget_get_name", parameters: [] },
        ];

        const result = filterSupportedMethods(methods, () => false);
        expect(result).toHaveLength(1);
    });

    it("filters out methods with unsupported callbacks", () => {
        const methods = [
            { name: "supported", cIdentifier: "gtk_supported", parameters: [] },
            { name: "unsupported", cIdentifier: "gtk_unsupported", parameters: [{ name: "callback" }] },
        ];

        const result = filterSupportedMethods(methods, (params) => params.length > 0);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("supported");
    });

    it("keeps first occurrence when duplicates exist", () => {
        const methods = [
            { name: "get_name", cIdentifier: "gtk_widget_get_name", parameters: [{ name: "first" }] },
            { name: "get_name", cIdentifier: "gtk_widget_get_name", parameters: [{ name: "second" }] },
        ];

        const result = filterSupportedMethods(methods, () => false);
        expect(result).toHaveLength(1);
        expect(result[0].parameters[0].name).toBe("first");
    });

    it("returns empty array for empty input", () => {
        const result = filterSupportedMethods([], () => false);
        expect(result).toEqual([]);
    });

    it("handles multiple different methods", () => {
        const methods = [
            { name: "method_a", cIdentifier: "c_method_a", parameters: [] },
            { name: "method_b", cIdentifier: "c_method_b", parameters: [] },
            { name: "method_c", cIdentifier: "c_method_c", parameters: [] },
        ];

        const result = filterSupportedMethods(methods, () => false);
        expect(result).toHaveLength(3);
    });
});

describe("CLASS_RENAMES", () => {
    it("contains Error -> GError mapping", () => {
        expect(CLASS_RENAMES.get("Error")).toBe("GError");
    });
});

describe("normalizeClassName", () => {
    it("converts snake_case to PascalCase", () => {
        expect(normalizeClassName("my_widget")).toBe("MyWidget");
    });

    it("converts kebab-case to PascalCase", () => {
        expect(normalizeClassName("my-widget")).toBe("MyWidget");
    });

    it("handles already PascalCase names", () => {
        expect(normalizeClassName("Button")).toBe("Button");
        expect(normalizeClassName("Widget")).toBe("Widget");
    });

    it("renames Error to GError", () => {
        expect(normalizeClassName("Error")).toBe("GError");
        expect(normalizeClassName("error")).toBe("GError");
    });

    it("handles Object from GObject namespace as GObject", () => {
        expect(normalizeClassName("Object", "GObject")).toBe("GObject");
    });

    it("handles Object from other namespaces with namespace prefix", () => {
        expect(normalizeClassName("Object", "Gtk")).toBe("GtkObject");
        expect(normalizeClassName("Object", "Gio")).toBe("GioObject");
    });

    it("does not modify Object when no namespace provided", () => {
        expect(normalizeClassName("Object")).toBe("Object");
    });

    it("handles lowercase single-word names", () => {
        expect(normalizeClassName("widget")).toBe("Widget");
        expect(normalizeClassName("button")).toBe("Button");
    });

    it("handles empty string", () => {
        expect(normalizeClassName("")).toBe("");
    });

    it("preserves names not in renames map", () => {
        expect(normalizeClassName("Button")).toBe("Button");
        expect(normalizeClassName("Label")).toBe("Label");
        expect(normalizeClassName("Window")).toBe("Window");
    });
});

describe("generateConflictingMethodName", () => {
    it("combines prefix and method name with PascalCase suffix", () => {
        expect(generateConflictingMethodName("Widget", "connect")).toBe("WidgetConnect");
        expect(generateConflictingMethodName("Button", "activate")).toBe("ButtonActivate");
    });

    it("handles snake_case names", () => {
        expect(generateConflictingMethodName("tree_view", "get_model")).toBe("treeViewGetModel");
    });

    it("handles kebab-case names", () => {
        expect(generateConflictingMethodName("list-box", "select-row")).toBe("listBoxSelectRow");
    });
});
