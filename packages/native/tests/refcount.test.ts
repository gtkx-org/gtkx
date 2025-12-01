import { describe, expect, it } from "vitest";
import { call, read } from "../index.js";
import { GOBJECT_LIB, GTK_LIB, setup } from "./integration.js";

setup();

const REFCOUNT_OFFSET = 8;

const getRefCount = (obj: unknown): number => {
    return read(obj, { type: "int", size: 32, unsigned: true }, REFCOUNT_OFFSET) as number;
};

describe("GObject Refcount Management", () => {
    describe("borrowed vs owned references", () => {
        it("should have correct refcount for borrowed GObject from constructor", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });

            const refCount = getRefCount(label);
            expect(refCount).toBeGreaterThanOrEqual(1);
        });

        it("should increment refcount when g_object_ref is called", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });

            const initialRef = getRefCount(label);

            call(GOBJECT_LIB, "g_object_ref", [{ type: { type: "gobject" }, value: label }], {
                type: "undefined",
            });

            const afterRef = getRefCount(label);
            expect(afterRef).toBe(initialRef + 1);

            call(GOBJECT_LIB, "g_object_unref", [{ type: { type: "gobject" }, value: label }], {
                type: "undefined",
            });

            const finalRef = getRefCount(label);
            expect(finalRef).toBe(initialRef);
        });

        it("should handle ref_sink for floating references", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const refCount = getRefCount(box);
            expect(refCount).toBeGreaterThanOrEqual(1);
        });
    });

    describe("widget tree refcounting", () => {
        it("should increment child refcount when added to parent", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Child" }], {
                type: "gobject",
                borrowed: true,
            });

            const refBefore = getRefCount(label);

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const refAfter = getRefCount(label);
            expect(refAfter).toBe(refBefore + 1);
        });

        it("should decrement child refcount when removed from parent", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 0 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Child" }], {
                type: "gobject",
                borrowed: true,
            });

            call(GOBJECT_LIB, "g_object_ref", [{ type: { type: "gobject" }, value: label }], {
                type: "gobject",
                borrowed: true,
            });

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const refAfterAdd = getRefCount(label);

            call(
                GTK_LIB,
                "gtk_box_remove",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const refAfterRemove = getRefCount(label);
            expect(refAfterRemove).toBe(refAfterAdd - 1);
        });

        it("should maintain correct refcounts with multiple children", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 1 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const labels: unknown[] = [];
            const initialRefs: number[] = [];

            for (let i = 0; i < 5; i++) {
                const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Label ${i}` }], {
                    type: "gobject",
                    borrowed: true,
                });
                labels.push(label);
                initialRefs.push(getRefCount(label));

                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: { type: "gobject" }, value: box },
                        { type: { type: "gobject" }, value: label },
                    ],
                    { type: "undefined" },
                );
            }

            labels.forEach((label, i) => {
                const currentRef = getRefCount(label);
                const expectedRef = initialRefs[i] ?? 0;
                expect(currentRef).toBe(expectedRef + 1);
            });
        });
    });

    describe("sibling navigation", () => {
        it("should return valid borrowed references for siblings", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 1 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const labels: unknown[] = [];
            for (let i = 0; i < 3; i++) {
                const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Label ${i}` }], {
                    type: "gobject",
                    borrowed: true,
                });
                labels.push(label);

                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: { type: "gobject" }, value: box },
                        { type: { type: "gobject" }, value: label },
                    ],
                    { type: "undefined" },
                );
            }

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: { type: "gobject" }, value: box }],
                {
                    type: "gobject",
                    borrowed: true,
                },
            );

            expect(firstChild).not.toBeNull();
            expect(getRefCount(firstChild)).toBeGreaterThanOrEqual(1);

            const secondChild = call(
                GTK_LIB,
                "gtk_widget_get_next_sibling",
                [{ type: { type: "gobject" }, value: firstChild }],
                { type: "gobject", borrowed: true },
            );

            expect(secondChild).not.toBeNull();
            expect(getRefCount(secondChild)).toBeGreaterThanOrEqual(1);

            const thirdChild = call(
                GTK_LIB,
                "gtk_widget_get_next_sibling",
                [{ type: { type: "gobject" }, value: secondChild }],
                { type: "gobject", borrowed: true },
            );

            expect(thirdChild).not.toBeNull();
            expect(getRefCount(thirdChild)).toBeGreaterThanOrEqual(1);

            const noMoreChildren = call(
                GTK_LIB,
                "gtk_widget_get_next_sibling",
                [{ type: { type: "gobject" }, value: thirdChild }],
                { type: "gobject", borrowed: true },
            );

            expect(noMoreChildren).toBeNull();
        });

        it("should iterate all children without memory issues", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 1 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            for (let i = 0; i < 10; i++) {
                const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: `Label ${i}` }], {
                    type: "gobject",
                    borrowed: true,
                });

                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: { type: "gobject" }, value: box },
                        { type: { type: "gobject" }, value: label },
                    ],
                    { type: "undefined" },
                );
            }

            let count = 0;
            let child = call(GTK_LIB, "gtk_widget_get_first_child", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            while (child !== null) {
                count++;
                expect(getRefCount(child)).toBeGreaterThanOrEqual(1);

                child = call(GTK_LIB, "gtk_widget_get_next_sibling", [{ type: { type: "gobject" }, value: child }], {
                    type: "gobject",
                    borrowed: true,
                });
            }

            expect(count).toBe(10);
        });
    });

    describe("Ref<GObject> out parameters", () => {
        it("should handle borrowed Ref<GObject> correctly", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 1 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: { type: "gobject" }, value: box }],
                {
                    type: "gobject",
                    borrowed: true,
                },
            );

            expect(firstChild).not.toBeNull();

            const labelText = call(GTK_LIB, "gtk_label_get_label", [{ type: { type: "gobject" }, value: firstChild }], {
                type: "string",
                borrowed: true,
            });

            expect(labelText).toBe("Test");
        });
    });

    describe("multiple wrappers for same object", () => {
        it("should maintain correct refcount when same object is retrieved multiple times", () => {
            const box = call(
                GTK_LIB,
                "gtk_box_new",
                [
                    { type: { type: "int", size: 32 }, value: 1 },
                    { type: { type: "int", size: 32 }, value: 0 },
                ],
                { type: "gobject", borrowed: true },
            );

            call(GOBJECT_LIB, "g_object_ref_sink", [{ type: { type: "gobject" }, value: box }], {
                type: "gobject",
                borrowed: true,
            });

            const label = call(GTK_LIB, "gtk_label_new", [{ type: { type: "string" }, value: "Test" }], {
                type: "gobject",
                borrowed: true,
            });

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: { type: "gobject" }, value: box },
                    { type: { type: "gobject" }, value: label },
                ],
                { type: "undefined" },
            );

            const refAfterAdd = getRefCount(label);

            const firstChild1 = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: { type: "gobject" }, value: box }],
                { type: "gobject", borrowed: true },
            );

            const firstChild2 = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: { type: "gobject" }, value: box }],
                { type: "gobject", borrowed: true },
            );

            const firstChild3 = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: { type: "gobject" }, value: box }],
                { type: "gobject", borrowed: true },
            );

            expect(firstChild1).not.toBeNull();
            expect(firstChild2).not.toBeNull();
            expect(firstChild3).not.toBeNull();

            const refAfterMultipleGets = getRefCount(label);
            expect(refAfterMultipleGets).toBe(refAfterAdd + 3);
        });
    });
});
