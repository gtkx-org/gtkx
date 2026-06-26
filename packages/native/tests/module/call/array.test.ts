import { describe, expect, it } from "vitest";
import {
    callArgs,
    createLabel,
    forceGC,
    GOBJECT_BORROWED,
    GTK_LIB,
    getRefCount,
    STRING,
    STRING_ARRAY,
    startMemoryMeasurement,
    VOID,
} from "../utils.js";

describe("call - array types - string arrays basic", () => {
    it("passes string array argument", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["class-a", "class-b", "class-c"] },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toEqual(["class-a", "class-b", "class-c"]);
    });

    it("returns string array", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["foo", "bar"] },
            ],
            VOID,
        );

        const classes = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(Array.isArray(classes)).toBe(true);
        expect(classes).toContain("foo");
        expect(classes).toContain("bar");
    });
});

describe("call - array types - string arrays empty and small", () => {
    it("handles empty string array", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: [] },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toEqual([]);
    });

    it("handles single-element array", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["single"] },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toEqual(["single"]);
    });
});

describe("call - array types - string arrays special content", () => {
    it("handles array with unicode strings", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["class-世界", "class-🎉"] },
            ],
            VOID,
        );

        const result = callArgs(
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

        callArgs(
            GTK_LIB,
            "gtk_widget_add_css_class",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "my-class" },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toContain("my-class");
    });
});

describe("call - array types - string arrays mutations", () => {
    it("removes css class using gtk_widget_remove_css_class", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["keep", "remove"] },
            ],
            VOID,
        );

        callArgs(
            GTK_LIB,
            "gtk_widget_remove_css_class",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "remove" },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toContain("keep");
        expect(result).not.toContain("remove");
    });
});

describe("call - array types - string arrays large", () => {
    it("handles large string arrays", () => {
        const label = createLabel("Test");
        const classes = Array.from({ length: 50 }, (_, i) => `class-${i}`);

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: classes },
            ],
            VOID,
        );

        const result = callArgs(
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

describe("call - array types - ownership", () => {
    it("handles owned arrays (caller frees)", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["owned-class"] },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toContain("owned-class");
    });
});

describe("call - array types - memory leaks", () => {
    it("does not leak string array elements", () => {
        const label = createLabel("Test");
        const labelRefCount = getRefCount(label);

        for (let i = 0; i < 500; i++) {
            callArgs(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: [`class-${i}-a`, `class-${i}-b`] },
                ],
                VOID,
            );
        }

        forceGC();

        expect(getRefCount(label)).toBe(labelRefCount);

        const result = callArgs(
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
            callArgs(
                GTK_LIB,
                "gtk_widget_set_css_classes",
                [
                    { type: GOBJECT_BORROWED, value: label },
                    { type: STRING_ARRAY, value: Array.from({ length: 10 }, (_, j) => `class-${i}-${j}`) },
                ],
                VOID,
            );

            callArgs(GTK_LIB, "gtk_widget_get_css_classes", [{ type: GOBJECT_BORROWED, value: label }], STRING_ARRAY);
        }

        expect(mem.measure()).toBeLessThan(10 * 1024 * 1024);
    });
});

describe("call - array types - memory leaks returned", () => {
    it("does not leak returned arrays", () => {
        const label = createLabel("Test");
        const labelRefCount = getRefCount(label);
        const mem = startMemoryMeasurement();

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["test-class"] },
            ],
            VOID,
        );

        for (let i = 0; i < 1000; i++) {
            callArgs(GTK_LIB, "gtk_widget_get_css_classes", [{ type: GOBJECT_BORROWED, value: label }], STRING_ARRAY);
        }

        expect(getRefCount(label)).toBe(labelRefCount);
        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
    });
});

describe("call - array types - edge cases basic", () => {
    it("handles null-terminated string arrays", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["a", "b", "c"] },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result.length).toBe(3);
    });
});

describe("call - array types - edge cases replacement", () => {
    it("handles replacing array completely", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["old-1", "old-2"] },
            ],
            VOID,
        );

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["new-1", "new-2", "new-3"] },
            ],
            VOID,
        );

        const result = callArgs(
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
});

describe("call - array types - edge cases duplicates and special", () => {
    it("handles array with duplicate values", () => {
        const label = createLabel("Test");

        callArgs(
            GTK_LIB,
            "gtk_widget_set_css_classes",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING_ARRAY, value: ["dup", "dup", "unique"] },
            ],
            VOID,
        );

        const result = callArgs(
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

        callArgs(
            GTK_LIB,
            "gtk_widget_add_css_class",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "valid-class" },
            ],
            VOID,
        );

        const result = callArgs(
            GTK_LIB,
            "gtk_widget_get_css_classes",
            [{ type: GOBJECT_BORROWED, value: label }],
            STRING_ARRAY,
        ) as string[];

        expect(result).toContain("valid-class");
    });
});
