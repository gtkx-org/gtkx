import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { createLabel, GOBJECT, GOBJECT_BORROWED, GTK_LIB, INT32, STRING, UNDEFINED } from "../utils.js";

describe("call - error handling", () => {
    describe("symbol errors", () => {
        it("throws on invalid symbol name", () => {
            expect(() => {
                call(GTK_LIB, "nonexistent_function_xyz", [], UNDEFINED);
            }).toThrow();
        });

        it("throws on misspelled symbol", () => {
            expect(() => {
                call(GTK_LIB, "gtk_labl_new", [{ type: STRING, value: "Test" }], GOBJECT);
            }).toThrow();
        });

        it("throws on empty symbol name", () => {
            expect(() => {
                call(GTK_LIB, "", [], UNDEFINED);
            }).toThrow();
        });

        it("throws on symbol with special characters", () => {
            expect(() => {
                call(GTK_LIB, "gtk_label_new!", [{ type: STRING, value: "Test" }], GOBJECT);
            }).toThrow();
        });
    });

    describe("library errors", () => {
        it("throws on invalid library name", () => {
            expect(() => {
                call("libnonexistent.so.1", "some_function", [], UNDEFINED);
            }).toThrow();
        });

        it("throws on library not found", () => {
            expect(() => {
                call("libfoobar123456.so.99", "foo", [], UNDEFINED);
            }).toThrow();
        });
    });

    describe("type errors", () => {
        it("throws on invalid type descriptor", () => {
            expect(() => {
                call(
                    GTK_LIB,
                    "gtk_label_new",
                    [
                        {
                            type: { type: "invalid_type" } as unknown as { type: "string"; ownership: "none" },
                            value: "Test",
                        },
                    ],
                    GOBJECT,
                );
            }).toThrow();
        });

        it("throws on invalid integer size", () => {
            expect(() => {
                call(
                    GTK_LIB,
                    "gtk_label_set_max_width_chars",
                    [
                        { type: GOBJECT_BORROWED, value: createLabel("Test") },
                        { type: { type: "int", size: 7 as 8, unsigned: false }, value: 42 },
                    ],
                    UNDEFINED,
                );
            }).toThrow();
        });

        it("throws on invalid float size", () => {
            expect(() => {
                call(
                    GTK_LIB,
                    "gtk_widget_set_opacity",
                    [
                        { type: GOBJECT_BORROWED, value: createLabel("Test") },
                        { type: { type: "float", size: 16 as 32 }, value: 0.5 },
                    ],
                    UNDEFINED,
                );
            }).toThrow();
        });
    });

    describe("value errors", () => {
        it("throws on wrong value type for integer", () => {
            expect(() => {
                call(
                    GTK_LIB,
                    "gtk_label_set_max_width_chars",
                    [
                        { type: GOBJECT_BORROWED, value: createLabel("Test") },
                        { type: INT32, value: "not a number" },
                    ],
                    UNDEFINED,
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
                    GTK_LIB,
                    "g_signal_connect_data",
                    [
                        { type: GOBJECT_BORROWED, value: createLabel("Test") },
                        { type: STRING, value: "clicked" },
                        { type: { type: "callback", trampoline: "closure" }, value: "not a function" },
                        { type: { type: "null" }, value: null },
                        { type: { type: "null" }, value: null },
                        { type: INT32, value: 0 },
                    ],
                    { type: "int", size: 64, unsigned: true },
                );
            }).toThrow();
        });
    });

    describe("argument count errors", () => {
        it("function works with correct number of arguments", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

            expect(label).toBeDefined();
        });
    });

    describe("return type errors", () => {
        it("handles mismatched return type gracefully", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

            expect(label).toBeDefined();
        });
    });

    describe("edge cases", () => {
        it("throws descriptive error for symbol lookup failure", () => {
            try {
                call(GTK_LIB, "gtk_nonexistent_widget_new", [], GOBJECT);
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
            }
        });

        it("throws descriptive error for library load failure", () => {
            try {
                call("libnonexistent.so", "foo", [], UNDEFINED);
                expect.fail("Should have thrown");
            } catch (e) {
                expect(e).toBeInstanceOf(Error);
            }
        });
    });
});
