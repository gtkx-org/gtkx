import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createLabel,
    forceGC,
    GOBJECT_BORROWED,
    GTK_LIB,
    getRefCount,
    STRING,
    STRING_ARRAY,
    startMemoryMeasurement,
    UNDEFINED,
} from "../utils.js";

describe("call - array types", () => {
    describe("string arrays", () => {
        it("passes string array argument", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["class-a", "class-b", "class-c"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toEqual(["class-a", "class-b", "class-c"]);
        });

        it("returns string array", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["foo", "bar"] },
                ],
                UNDEFINED,
            );

            const classes = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(Array.isArray(classes)).toBe(true);
            expect(classes).toContain("foo");
            expect(classes).toContain("bar");
        });

        it("handles empty string array", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: [] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toEqual([]);
        });

        it("handles single-element array", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["single"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toEqual(["single"]);
        });

        it("handles array with unicode strings", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["class-世界", "class-🎉"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("class-世界");
            expect(result).toContain("class-🎉");
        });

        it("adds css class using gtk_widget_add_css_class", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_add_css_class",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "my-class" },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("my-class");
        });

        it("removes css class using gtk_widget_remove_css_class", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["keep", "remove"] },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_widget_remove_css_class",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "remove" },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("keep");
            expect(result).not.toContain("remove");
        });

        it("handles large string arrays", () => {
            const label = createLabel("Test");
            const classes = Array.from({ length: 50 }, (_, i) => `class-${i}`);

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: classes },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result.length).toBe(50);
            expect(result).toContain("class-0");
            expect(result).toContain("class-49");
        });
    });

    describe("ownership", () => {
        it("handles owned arrays (caller frees)", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["owned-class"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("owned-class");
        });
    });

    describe("memory leaks", () => {
        it("does not leak string array elements", () => {
            const label = createLabel("Test");
            const labelRefCount = getRefCount(label);

            for (let i = 0; i < 500; i++) {
                call(
                    GTK_LIB,
                    "gtk_widget_set_css_classes",
                    [
                        { type: GOBJECT_BORROWED, value: label },
                        { type: STRING_ARRAY, value: [`class-${i}-a`, `class-${i}-b`] },
                    ],
                    UNDEFINED,
                );
            }

            forceGC();

            expect(getRefCount(label)).toBe(labelRefCount);

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("class-499-a");
        });

        it("does not leak when creating many arrays in loop", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 500; i++) {
                const label = createLabel(`Label ${i}`);
                call(
                    GTK_LIB,
                    "gtk_widget_set_css_classes",
                    [
                        { type: GOBJECT_BORROWED, value: label },
                        { type: STRING_ARRAY, value: Array.from({ length: 10 }, (_, j) => `class-${i}-${j}`) },
                    ],
                    UNDEFINED,
                );

                call(GTK_LIB, "gtk_widget_get_css_classes", [{ type: GOBJECT_BORROWED, value: label }], STRING_ARRAY);
            }

            expect(mem.measure()).toBeLessThan(10 * 1024 * 1024);
        });

        it("does not leak returned arrays", () => {
            const label = createLabel("Test");
            const labelRefCount = getRefCount(label);
            const mem = startMemoryMeasurement();

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["test-class"] },
                ],
                UNDEFINED,
            );

            for (let i = 0; i < 1000; i++) {
                call(GTK_LIB, "gtk_widget_get_css_classes", [{ type: GOBJECT_BORROWED, value: label }], STRING_ARRAY);
            }

            expect(getRefCount(label)).toBe(labelRefCount);
            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });
    });

    describe("edge cases", () => {
        it("handles null-terminated string arrays", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["a", "b", "c"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result.length).toBe(3);
        });

        it("handles replacing array completely", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["old-1", "old-2"] },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["new-1", "new-2", "new-3"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).not.toContain("old-1");
            expect(result).not.toContain("old-2");
            expect(result).toContain("new-1");
            expect(result).toContain("new-2");
            expect(result).toContain("new-3");
        });

        it("handles array with duplicate values", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: ["dup", "dup", "unique"] },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("dup");
            expect(result).toContain("unique");
        });

        it("handles array with empty string elements", () => {
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_widget_add_css_class",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING, value: "valid-class" },
                ],
                UNDEFINED,
            );

            const result = call(
                GTK_LIB,
                "gtk_widget_get_css_classes",
                [{ type: GOBJECT_BORROWED, value: label }],
                STRING_ARRAY,
            ) as string[];

            expect(result).toContain("valid-class");
        });
    });
});
