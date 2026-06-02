import { describe, expect, it } from "vitest";
import { call } from "../../../index.js";
import { expectClickedSignalHandlerId } from "../call-callback-integer-helpers.js";
import {
    connectSignal,
    connectSignalReturning,
    createBox,
    createButton,
    createGrid,
    createLabel,
    disconnectSignal,
    GOBJECT,
    GOBJECT_BORROWED,
    GOBJECT_LIB,
    GTK_LIB,
    INT8,
    INT16,
    INT32,
    INT64,
    UINT8,
    UINT16,
    UINT32,
    UINT64,
    VOID,
} from "../utils.js";
import { setAndGetLabelMaxWidthChars } from "./_helpers.js";

describe("call - integer types - 8-bit signed", () => {
    it("handles signed 8-bit as part of boolean-like values", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: INT8, value: 1 },
            ],
            VOID,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], INT8);

        expect(result).toBe(1);
    });

    it("handles zero value", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: INT8, value: 0 },
            ],
            VOID,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], INT8);

        expect(result).toBe(0);
    });
});

describe("call - integer types - 8-bit unsigned", () => {
    it("handles unsigned 8-bit values", () => {
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_label_set_selectable",
            [
                { type: GOBJECT_BORROWED, value: label },
                { type: UINT8, value: 1 },
            ],
            VOID,
        );

        const result = call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], UINT8);

        expect(result).toBe(1);
    });
});

describe("call - integer types - 16-bit signed", () => {
    it("passes and returns 16-bit signed integers", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT16, 100);

        expect(result).toBe(100);
    });

    it("handles negative 16-bit values", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT16, -1);

        expect(result).toBe(-1);
    });
});

describe("call - integer types - 16-bit unsigned", () => {
    it("passes and returns 16-bit unsigned integers", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, UINT16, 500);

        expect(result).toBe(500);
    });
});

describe("call - integer types - 32-bit signed basic", () => {
    it("passes and returns 32-bit signed integers", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT32, 42);

        expect(result).toBe(42);
    });

    it("handles negative 32-bit values", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT32, -1);

        expect(result).toBe(-1);
    });
});

describe("call - integer types - 32-bit signed zero", () => {
    it("handles zero", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT32, 0);

        expect(result).toBe(0);
    });
});

describe("call - integer types - 32-bit signed large", () => {
    it("handles large positive values", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT32, 100000);

        expect(result).toBe(100000);
    });
});

describe("call - integer types - 32-bit signed enums", () => {
    it("handles enum values (GtkOrientation)", () => {
        const boxHorizontal = call(
            GTK_LIB,
            "gtk_box_new",
            [
                { type: INT32, value: 0 },
                { type: INT32, value: 0 },
            ],
            GOBJECT,
        );

        const boxVertical = call(
            GTK_LIB,
            "gtk_box_new",
            [
                { type: INT32, value: 1 },
                { type: INT32, value: 0 },
            ],
            GOBJECT,
        );

        const orientationH = call(
            GTK_LIB,
            "gtk_orientable_get_orientation",
            [{ type: GOBJECT_BORROWED, value: boxHorizontal }],
            INT32,
        );

        const orientationV = call(
            GTK_LIB,
            "gtk_orientable_get_orientation",
            [{ type: GOBJECT_BORROWED, value: boxVertical }],
            INT32,
        );

        expect(orientationH).toBe(0);
        expect(orientationV).toBe(1);
    });
});

describe("call - integer types - 32-bit unsigned", () => {
    it("passes and returns 32-bit unsigned integers", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, UINT32, 200);

        expect(result).toBe(200);
    });

    it("handles flags values (GApplicationFlags)", () => {
        const box = createBox(0, 5);

        call(
            GTK_LIB,
            "gtk_box_set_spacing",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: UINT32, value: 10 },
            ],
            VOID,
        );

        const spacing = call(GTK_LIB, "gtk_box_get_spacing", [{ type: GOBJECT_BORROWED, value: box }], UINT32);

        expect(spacing).toBe(10);
    });
});

describe("call - integer types - 64-bit signed", () => {
    it("passes and returns 64-bit signed integers", () => {
        const button = createButton("Test");

        const handlerId = connectSignalReturning(button, "clicked", () => {}, INT64);

        expect(typeof handlerId).toBe("number");
        expect(handlerId as number).toBeGreaterThan(0);
    });
});

describe("call - integer types - 64-bit unsigned basic", () => {
    it("passes and returns 64-bit unsigned integers", () => {
        expectClickedSignalHandlerId();
    });
});

describe("call - integer types - 64-bit unsigned disconnect", () => {
    it("handles signal handler disconnection", () => {
        const button = createButton("Test");

        const handlerId = connectSignal(button, "clicked", () => {});

        disconnectSignal(button, handlerId);

        const isConnected = call(
            GOBJECT_LIB,
            "g_signal_handler_is_connected",
            [
                { type: GOBJECT_BORROWED, value: button },
                { type: UINT64, value: handlerId },
            ],
            INT32,
        );

        expect(isConnected).toBe(0);
    });
});

describe("call - integer types - edge cases simultaneous", () => {
    it("handles integer as argument and return type simultaneously", () => {
        const label = createLabel("Test");

        const result = setAndGetLabelMaxWidthChars(label, INT32, 50);

        expect(result).toBe(50);
    });
});

describe("call - integer types - edge cases multi-arg", () => {
    it("handles multiple integer arguments of different sizes", () => {
        const grid = createGrid();
        const label = createLabel("Test");

        call(
            GTK_LIB,
            "gtk_grid_attach",
            [
                { type: GOBJECT_BORROWED, value: grid },
                { type: GOBJECT_BORROWED, value: label },
                { type: INT32, value: 0 },
                { type: INT32, value: 0 },
                { type: INT32, value: 1 },
                { type: INT32, value: 1 },
            ],
            VOID,
        );

        const firstChild = call(
            GTK_LIB,
            "gtk_widget_get_first_child",
            [{ type: GOBJECT_BORROWED, value: grid }],
            GOBJECT_BORROWED,
        );

        expect(firstChild).toBeDefined();
    });
});

describe("call - integer types - edge cases spacing", () => {
    it("handles spacing values in containers", () => {
        const box = createBox(0, 0);

        call(
            GTK_LIB,
            "gtk_box_set_spacing",
            [
                { type: GOBJECT_BORROWED, value: box },
                { type: INT32, value: 15 },
            ],
            VOID,
        );

        const spacing = call(GTK_LIB, "gtk_box_get_spacing", [{ type: GOBJECT_BORROWED, value: box }], INT32);

        expect(spacing).toBe(15);
    });
});
