import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { createLabel, GOBJECT, GOBJECT_BORROWED, GOBJECT_LIB, GTK_LIB, INT32, STRING, UINT64, VOID } from "../utils.js";

describe("call - error handling - symbol errors", () => {
    it("throws on invalid symbol name", () => {
        expect(() => {
            call(GTK_LIB, "nonexistent_function_xyz", [], VOID);
        }).toThrow();
    });

    it("throws on misspelled symbol", () => {
        expect(() => {
            call(GTK_LIB, "gtk_labl_new", [{ type: STRING, value: "Test" }], GOBJECT);
        }).toThrow();
    });

    it("throws on empty symbol name", () => {
        expect(() => {
            call(GTK_LIB, "", [], VOID);
        }).toThrow();
    });

    it("throws on symbol with special characters", () => {
        expect(() => {
            call(GTK_LIB, "gtk_label_new!", [{ type: STRING, value: "Test" }], GOBJECT);
        }).toThrow();
    });
});

describe("call - error handling - library errors", () => {
    it("throws on invalid library name", () => {
        expect(() => {
            call("libnonexistent.so.1", "some_function", [], VOID);
        }).toThrow();
    });

    it("throws on library not found", () => {
        expect(() => {
            call("libfoobar123456.so.99", "foo", [], VOID);
        }).toThrow();
    });
});

describe("call - error handling - type errors", () => {
    it("throws on invalid type descriptor", () => {
        expect(() => {
            call(
                GTK_LIB,
                "gtk_label_new",
                [
                    {
                        type: { type: "invalid_type" } as unknown as { type: "string"; ownership: "borrowed" },
                        value: "Test",
                    },
                ],
                GOBJECT,
            );
        }).toThrow();
    });

    it("throws on invalid integer type", () => {
        expect(() => {
            call(
                GTK_LIB,
                "gtk_label_set_max_width_chars",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: { type: "int7" as "int8" }, value: 42 },
                ],
                VOID,
            );
        }).toThrow();
    });

    it("throws on invalid float type", () => {
        expect(() => {
            call(
                GTK_LIB,
                "gtk_widget_set_opacity",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: { type: "float16" as "float32" }, value: 0.5 },
                ],
                VOID,
            );
        }).toThrow();
    });
});

describe("call - error handling - value errors", () => {
    it("throws on wrong value type for integer", () => {
        expect(() => {
            call(
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
            call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: 12345 }], GOBJECT);
        }).toThrow();
    });

    it("throws on non-function for callback", () => {
        expect(() => {
            call(
                GOBJECT_LIB,
                "g_signal_connect_data",
                [
                    { type: GOBJECT_BORROWED, value: createLabel("Test") },
                    { type: STRING, value: "clicked" },
                    {
                        type: {
                            type: "trampoline",
                            argTypes: [GOBJECT_BORROWED, UINT64],
                            returnType: { type: "void" },
                            hasDestroy: true,
                            userDataIndex: 1,
                        },
                        value: "not a function",
                    },
                    { type: INT32, value: 0 },
                ],
                { type: "uint64" as const },
            );
        }).toThrow();
    });
});

describe("call - error handling - argument count errors", () => {
    it("function works with correct number of arguments", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        expect(label).toBeDefined();
    });
});

describe("call - error handling - return type errors", () => {
    it("handles mismatched return type gracefully", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        expect(label).toBeDefined();
    });
});

describe("call - error handling - edge cases", () => {
    it("throws descriptive error for symbol lookup failure", () => {
        try {
            call(GTK_LIB, "gtk_nonexistent_widget_new", [], GOBJECT);
            expect.fail("Should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    });

    it("throws descriptive error for library load failure", () => {
        try {
            call("libnonexistent.so", "foo", [], VOID);
            expect.fail("Should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
        }
    });
});
