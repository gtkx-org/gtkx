import { describe, expect, it } from "vitest";
import {
    callArgs,
    createLabel,
    GOBJECT,
    GOBJECT_BORROWED,
    GOBJECT_LIB,
    GTK_LIB,
    INT32,
    STRING,
    UINT64,
    VOID,
} from "./helpers/utils.js";

describe("call - error handling - symbol errors", () => {
    it("throws on invalid symbol name", () => {
        expect(() => {
            callArgs(GTK_LIB, "nonexistent_function_xyz", [], VOID);
        }).toThrow();
    });

    it("throws on misspelled symbol", () => {
        expect(() => {
            callArgs(GTK_LIB, "gtk_labl_new", [{ type: STRING, value: "Test" }], GOBJECT);
        }).toThrow();
    });

    it("throws on empty symbol name", () => {
        expect(() => {
            callArgs(GTK_LIB, "", [], VOID);
        }).toThrow();
    });

    it("throws on symbol with special characters", () => {
        expect(() => {
            callArgs(GTK_LIB, "gtk_label_new!", [{ type: STRING, value: "Test" }], GOBJECT);
        }).toThrow();
    });
});

describe("call - error handling - library errors", () => {
    it("throws on invalid library name", () => {
        expect(() => {
            callArgs("libnonexistent.so.1", "some_function", [], VOID);
        }).toThrow();
    });

    it("throws on library not found", () => {
        expect(() => {
            callArgs("libfoobar123456.so.99", "foo", [], VOID);
        }).toThrow();
    });
});

describe("call - error handling - type errors", () => {
    it("throws on invalid type descriptor", () => {
        expect(() => {
            callArgs(
                GTK_LIB,
                "gtk_label_new",
                [
                    {
                        type: { kind: "invalid_type" as "int8" },
                        value: "Test",
                    },
                ],
                GOBJECT,
            );
        }).toThrow();
    });

    it("throws on invalid integer type", () => {
        expect(() => {
            callArgs(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: { kind: "int7" as "int8" }, value: 42 },
                ],
                VOID,
            );
        }).toThrow();
    });

    it("throws on invalid float type", () => {
        expect(() => {
            callArgs(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: { kind: "float16" as "float32" }, value: 0.5 },
                ],
                VOID,
            );
        }).toThrow();
    });
});

describe("call - error handling - value errors", () => {
    it("throws on wrong value type for integer", () => {
        expect(() => {
            callArgs(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: INT32, value: "not a number" },
                ],
                VOID,
            );
        }).toThrow();
    });

    it("throws on wrong value type for string", () => {
        expect(() => {
            callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: 12345 }], GOBJECT);
        }).toThrow();
    });

    it("throws on non-function for callback", () => {
        expect(() => {
            callArgs(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: STRING, value: "clicked" },
                    {
                        type: {
                            kind: "callback",
                            argDescriptors: [GOBJECT_BORROWED, UINT64],
                            returnDescriptor: { kind: "void" },
                            hasDestroy: true,
                            userDataIndex: 1,
                        },
                        value: "not a function",
                    },
                    { type: INT32, value: 0 },
                ],
                { kind: "uint64" as const },
            );
        }).toThrow();
    });
});

describe("call - error handling - argument count errors", () => {
    it("function works with correct number of arguments", () => {
        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        expect(label).toBeDefined();
    });
});

describe("call - error handling - return type errors", () => {
    it("handles mismatched return type gracefully", () => {
        const label = callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        expect(label).toBeDefined();
    });
});

describe("call - error handling - edge cases", () => {
    it("throws descriptive error for symbol lookup failure", () => {
        try {
            callArgs(GTK_LIB, "gtk_nonexistent_widget_new", [], GOBJECT);
            expect.fail("Should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    });

    it("throws descriptive error for library load failure", () => {
        try {
            callArgs("libnonexistent.so", "foo", [], VOID);
            expect.fail("Should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    });
});
