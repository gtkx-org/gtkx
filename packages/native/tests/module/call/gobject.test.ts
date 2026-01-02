import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import {
    createBox,
    createButton,
    createLabel,
    forceGC,
    GOBJECT,
    GOBJECT_NONE,
    GTK_LIB,
    getRefCount,
    STRING,
    STRING_NONE,
    startMemoryMeasurement,
    UNDEFINED,
} from "../utils.js";

describe("call - gobject types", () => {
    describe("owned gobjects", () => {
        it("creates and returns owned GObject", () => {
            const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

            expect(label).toBeDefined();
            expect(typeof label).toBe("object");
        });

        it("passes owned GObject as argument", () => {
            const box = createBox();
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(firstChild).toBeDefined();
        });

        it("creates different widget types", () => {
            const label = createLabel("Label");
            const button = createButton("Button");
            const box = createBox();

            expect(label).toBeDefined();
            expect(button).toBeDefined();
            expect(box).toBeDefined();

            expect(label).not.toBe(button);
            expect(button).not.toBe(box);
        });
    });

    describe("transfer none gobjects", () => {
        it("returns transfer none GObject (parent relationship)", () => {
            const box = createBox();
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            const parent = call(GTK_LIB, "gtk_widget_get_parent", [{ type: GOBJECT_NONE, value: label }], GOBJECT_NONE);

            expect(parent).toBeDefined();
        });

        it("transfer none GObject remains valid with parent", () => {
            const box = createBox();
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            const child1 = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            const child2 = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(child1).toBeDefined();
            expect(child2).toBeDefined();
        });

        it("passes GObject as transfer none argument", () => {
            const label = createLabel("Test");

            const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(text).toBe("Test");
        });
    });

    describe("widget hierarchy", () => {
        it("creates parent-child relationships", () => {
            const box = createBox();
            const label1 = createLabel("First");
            const label2 = createLabel("Second");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label1 },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label2 },
                ],
                UNDEFINED,
            );

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            const lastChild = call(
                GTK_LIB,
                "gtk_widget_get_last_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(firstChild).toBeDefined();
            expect(lastChild).toBeDefined();
            expect(firstChild).not.toBe(lastChild);
        });

        it("retrieves children from containers", () => {
            const box = createBox();
            const label = createLabel("Child");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            const child = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(child).toBeDefined();
        });

        it("retrieves parent from child", () => {
            const box = createBox();
            const label = createLabel("Child");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            const parent = call(GTK_LIB, "gtk_widget_get_parent", [{ type: GOBJECT_NONE, value: label }], GOBJECT_NONE);

            expect(parent).toBeDefined();
        });

        it("traverses sibling chain", () => {
            const box = createBox();
            const label1 = createLabel("First");
            const label2 = createLabel("Second");
            const label3 = createLabel("Third");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label1 },
                ],
                UNDEFINED,
            );
            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label2 },
                ],
                UNDEFINED,
            );
            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label3 },
                ],
                UNDEFINED,
            );

            const first = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            const second = call(
                GTK_LIB,
                "gtk_widget_get_next_sibling",
                [{ type: GOBJECT_NONE, value: first }],
                GOBJECT_NONE,
            );

            const third = call(
                GTK_LIB,
                "gtk_widget_get_next_sibling",
                [{ type: GOBJECT_NONE, value: second }],
                GOBJECT_NONE,
            );

            expect(first).toBeDefined();
            expect(second).toBeDefined();
            expect(third).toBeDefined();
        });

        it("removes child from parent", () => {
            const box = createBox();
            const label = createLabel("Removable");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            let child = call(GTK_LIB, "gtk_widget_get_first_child", [{ type: GOBJECT_NONE, value: box }], GOBJECT_NONE);
            expect(child).toBeDefined();

            call(
                GTK_LIB,
                "gtk_box_remove",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            child = call(GTK_LIB, "gtk_widget_get_first_child", [{ type: GOBJECT_NONE, value: box }], GOBJECT_NONE);
            expect(child).toBeNull();
        });
    });

    describe("refcount management", () => {
        it("container adds ref when child is appended", () => {
            const box = createBox();
            const label = createLabel("Test");
            const initialRefCount = getRefCount(label);

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            expect(getRefCount(label)).toBe(initialRefCount + 1);

            const child = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(child).toBeDefined();
        });

        it("does not increase refcount when passing transfer none GObject", () => {
            const label = createLabel("Test");
            const initialRefCount = getRefCount(label);

            for (let i = 0; i < 100; i++) {
                call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);
            }

            expect(getRefCount(label)).toBe(initialRefCount);
        });

        it("container releases ref when child is removed", () => {
            const box = createBox();
            const label = createLabel("Test");
            const initialRefCount = getRefCount(label);

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            expect(getRefCount(label)).toBe(initialRefCount + 1);

            call(
                GTK_LIB,
                "gtk_box_remove",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            expect(getRefCount(label)).toBe(initialRefCount);
        });
    });

    describe("memory leaks", () => {
        it("does not leak when creating many GObjects in loop", () => {
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 1000; i++) {
                createLabel(`Label ${i}`);
            }

            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);
        });

        it("does not leak when passing GObject to container", () => {
            const box = createBox();
            const boxRefCount = getRefCount(box);
            const mem = startMemoryMeasurement();

            for (let i = 0; i < 100; i++) {
                const label = createLabel(`Label ${i}`);
                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: GOBJECT_NONE, value: box },
                        { type: GOBJECT_NONE, value: label },
                    ],
                    UNDEFINED,
                );
            }

            expect(getRefCount(box)).toBe(boxRefCount);
            expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);

            const firstChild = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(firstChild).toBeDefined();
        });

        it("does not leak when removing GObject from container", () => {
            const box = createBox();
            const boxRefCount = getRefCount(box);
            const labels: unknown[] = [];

            for (let i = 0; i < 50; i++) {
                const label = createLabel(`Label ${i}`);
                labels.push(label);
                call(
                    GTK_LIB,
                    "gtk_box_append",
                    [
                        { type: GOBJECT_NONE, value: box },
                        { type: GOBJECT_NONE, value: label },
                    ],
                    UNDEFINED,
                );
            }

            for (const label of labels) {
                call(
                    GTK_LIB,
                    "gtk_box_remove",
                    [
                        { type: GOBJECT_NONE, value: box },
                        { type: GOBJECT_NONE, value: label },
                    ],
                    UNDEFINED,
                );
            }

            expect(getRefCount(box)).toBe(boxRefCount);

            forceGC();

            const child = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: box }],
                GOBJECT_NONE,
            );

            expect(child).toBeNull();
        });
    });

    describe("edge cases", () => {
        it("handles null GObject when optional", () => {
            const label = createLabel("Test");

            const parent = call(GTK_LIB, "gtk_widget_get_parent", [{ type: GOBJECT_NONE, value: label }], GOBJECT_NONE);

            expect(parent).toBeNull();
        });

        it("handles same GObject passed multiple times", () => {
            const box = createBox();
            const label = createLabel("Test");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: box },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            call(
                GTK_LIB,
                "gtk_label_set_text",
                [
                    { type: GOBJECT_NONE, value: label },
                    { type: STRING, value: "Updated" },
                ],
                UNDEFINED,
            );

            const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_NONE, value: label }], STRING_NONE);

            expect(text).toBe("Updated");
        });

        it("handles deeply nested widget hierarchy", () => {
            const outerBox = createBox(1, 0);
            const middleBox = createBox(0, 0);
            const innerBox = createBox(1, 0);
            const label = createLabel("Deep");

            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: outerBox },
                    { type: GOBJECT_NONE, value: middleBox },
                ],
                UNDEFINED,
            );
            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: middleBox },
                    { type: GOBJECT_NONE, value: innerBox },
                ],
                UNDEFINED,
            );
            call(
                GTK_LIB,
                "gtk_box_append",
                [
                    { type: GOBJECT_NONE, value: innerBox },
                    { type: GOBJECT_NONE, value: label },
                ],
                UNDEFINED,
            );

            let current = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: outerBox }],
                GOBJECT_NONE,
            );

            current = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: current }],
                GOBJECT_NONE,
            );

            current = call(
                GTK_LIB,
                "gtk_widget_get_first_child",
                [{ type: GOBJECT_NONE, value: current }],
                GOBJECT_NONE,
            );

            expect(current).toBeDefined();
        });
    });
});
