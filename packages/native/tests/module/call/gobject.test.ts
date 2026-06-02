import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { appendLabelAndExpectRefIncrement, expectNoLeakCreatingLabels } from "../call-gobject-string-helpers.js";
import {
    boxAppend,
    boxRemove,
    createBox,
    createButton,
    createLabel,
    forceGC,
    GOBJECT,
    GOBJECT_BORROWED,
    GTK_LIB,
    getFirstChild,
    getNextSibling,
    getParent,
    getRefCount,
    STRING,
    STRING_BORROWED,
    startMemoryMeasurement,
    VOID,
} from "../utils.js";

describe("call - gobject types - owned", () => {
    it("creates and returns owned GObject", () => {
        const label = call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: "Test" }], GOBJECT);

        expect(label).toBeDefined();
        expect(typeof label).toBe("object");
    });

    it("passes owned GObject as argument", () => {
        const box = createBox();
        const label = createLabel("Test");

        boxAppend(box, label);

        expect(getFirstChild(box)).toBeDefined();
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

describe("call - gobject types - transfer none", () => {
    it("returns transfer none GObject (parent relationship)", () => {
        const box = createBox();
        const label = createLabel("Test");

        boxAppend(box, label);

        expect(getParent(label)).toBeDefined();
    });

    it("transfer none GObject remains valid with parent", () => {
        const box = createBox();
        const label = createLabel("Test");

        boxAppend(box, label);

        expect(getFirstChild(box)).toBeDefined();
        expect(getFirstChild(box)).toBeDefined();
    });

    it("passes GObject as transfer none argument", () => {
        const label = createLabel("Test");

        const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);

        expect(text).toBe("Test");
    });
});

describe("call - gobject types - widget hierarchy parent-child", () => {
    it("creates parent-child relationships", () => {
        const box = createBox();
        const label1 = createLabel("First");
        const label2 = createLabel("Second");

        boxAppend(box, label1);

        boxAppend(box, label2);

        const firstChild = getFirstChild(box);
        const lastChild = call(
            GTK_LIB,
            "gtk_widget_get_last_child",
            [{ type: GOBJECT_BORROWED, value: box }],
            GOBJECT_BORROWED,
        );

        expect(firstChild).toBeDefined();
        expect(lastChild).toBeDefined();
        expect(firstChild).not.toBe(lastChild);
    });
});

describe("call - gobject types - widget hierarchy children", () => {
    it("retrieves children from containers", () => {
        const box = createBox();
        const label = createLabel("Child");

        boxAppend(box, label);

        expect(getFirstChild(box)).toBeDefined();
    });

    it("retrieves parent from child", () => {
        const box = createBox();
        const label = createLabel("Child");

        boxAppend(box, label);

        expect(getParent(label)).toBeDefined();
    });
});

describe("call - gobject types - widget hierarchy siblings", () => {
    it("traverses sibling chain", () => {
        const box = createBox();
        const label1 = createLabel("First");
        const label2 = createLabel("Second");
        const label3 = createLabel("Third");

        boxAppend(box, label1);
        boxAppend(box, label2);
        boxAppend(box, label3);

        const first = getFirstChild(box);
        const second = getNextSibling(first);
        const third = getNextSibling(second);

        expect(first).toBeDefined();
        expect(second).toBeDefined();
        expect(third).toBeDefined();
    });
});

describe("call - gobject types - widget hierarchy remove", () => {
    it("removes child from parent", () => {
        const box = createBox();
        const label = createLabel("Removable");

        boxAppend(box, label);

        expect(getFirstChild(box)).toBeDefined();

        boxRemove(box, label);

        expect(getFirstChild(box)).toBeNull();
    });
});

describe("call - gobject types - refcount management add", () => {
    it("container adds ref when child is appended", () => {
        const { box } = appendLabelAndExpectRefIncrement();

        expect(getFirstChild(box)).toBeDefined();
    });
});

describe("call - gobject types - refcount transfer none", () => {
    it("does not increase refcount when passing transfer none GObject", () => {
        const label = createLabel("Test");
        const initialRefCount = getRefCount(label);

        for (let i = 0; i < 100; i++) {
            call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);
        }

        expect(getRefCount(label)).toBe(initialRefCount);
    });
});

describe("call - gobject types - refcount release", () => {
    it("container releases ref when child is removed", () => {
        const { box, label, initialRefCount } = appendLabelAndExpectRefIncrement();

        boxRemove(box, label);

        expect(getRefCount(label)).toBe(initialRefCount);
    });
});

describe("call - gobject types - memory leaks creation", () => {
    it("does not leak when creating many GObjects in loop", () => {
        expectNoLeakCreatingLabels();
    });
});

describe("call - gobject types - memory leaks container append", () => {
    it("does not leak when passing GObject to container", () => {
        const box = createBox();
        const boxRefCount = getRefCount(box);
        const mem = startMemoryMeasurement();

        for (let i = 0; i < 100; i++) {
            const label = createLabel(`Label ${i}`);
            boxAppend(box, label);
        }

        expect(getRefCount(box)).toBe(boxRefCount);
        expect(mem.measure()).toBeLessThan(5 * 1024 * 1024);

        expect(getFirstChild(box)).toBeDefined();
    });
});

describe("call - gobject types - memory leaks container remove", () => {
    it("does not leak when removing GObject from container", () => {
        const box = createBox();
        const boxRefCount = getRefCount(box);
        const labels: unknown[] = [];

        for (let i = 0; i < 50; i++) {
            const label = createLabel(`Label ${i}`);
            labels.push(label);
            boxAppend(box, label);
        }

        for (const label of labels) {
            boxRemove(box, label);
        }

        expect(getRefCount(box)).toBe(boxRefCount);

        forceGC();

        expect(getFirstChild(box)).toBeNull();
    });
});

describe("call - gobject types - edge cases null", () => {
    it("handles null GObject when optional", () => {
        const label = createLabel("Test");

        expect(getParent(label)).toBeNull();
    });
});

describe("call - gobject types - edge cases multiple pass", () => {
    it("handles same GObject passed multiple times", () => {
        const box = createBox();
        const label = createLabel("Test");

        boxAppend(box, label);

        call(
            GTK_LIB,
            "gtk_label_set_text",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: STRING, value: "Updated" },
            ],
            VOID,
        );

        const text = call(GTK_LIB, "gtk_label_get_text", [{ type: GOBJECT_BORROWED, value: label }], STRING_BORROWED);

        expect(text).toBe("Updated");
    });
});

describe("call - gobject types - edge cases nested", () => {
    it("handles deeply nested widget hierarchy", () => {
        const outerBox = createBox(1, 0);
        const middleBox = createBox(0, 0);
        const innerBox = createBox(1, 0);
        const label = createLabel("Deep");

        boxAppend(outerBox, middleBox);
        boxAppend(middleBox, innerBox);
        boxAppend(innerBox, label);

        let current = getFirstChild(outerBox);
        current = getFirstChild(current);
        current = getFirstChild(current);

        expect(current).toBeDefined();
    });
});
