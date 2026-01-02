import { call, createRef, read } from "../../index.js";

export { createRef };

const GOBJECT_REF_COUNT_OFFSET = 8;

export const GTK_LIB = "libgtk-4.so.1";
export const GDK_LIB = "libgtk-4.so.1";
export const GOBJECT_LIB = "libgobject-2.0.so.0";
export const GIO_LIB = "libgio-2.0.so.0";
export const PANGO_LIB = "libpango-1.0.so.0";
export const INT8 = { type: "int" as const, size: 8 as const, unsigned: false as const };
export const INT16 = { type: "int" as const, size: 16 as const, unsigned: false as const };
export const INT32 = { type: "int" as const, size: 32 as const, unsigned: false as const };
export const INT64 = { type: "int" as const, size: 64 as const, unsigned: false as const };
export const UINT8 = { type: "int" as const, size: 8 as const, unsigned: true as const };
export const UINT16 = { type: "int" as const, size: 16 as const, unsigned: true as const };
export const UINT32 = { type: "int" as const, size: 32 as const, unsigned: true as const };
export const UINT64 = { type: "int" as const, size: 64 as const, unsigned: true as const };
export const FLOAT32 = { type: "float" as const, size: 32 as const };
export const FLOAT64 = { type: "float" as const, size: 64 as const };
export const BOOLEAN = { type: "boolean" as const };
export const STRING = { type: "string" as const, ownership: "full" as const };
export const STRING_NONE = { type: "string" as const, ownership: "none" as const };
export const STRING_BORROWED = STRING_NONE;
export const GOBJECT = { type: "gobject" as const, ownership: "full" as const };
export const GOBJECT_NONE = { type: "gobject" as const, ownership: "none" as const };
export const GOBJECT_BORROWED = GOBJECT_NONE;
export const NULL = { type: "null" as const };
export const UNDEFINED = { type: "undefined" as const };
export const STRING_ARRAY = {
    type: "array" as const,
    itemType: STRING,
    listType: "array" as const,
    ownership: "full" as const,
};
export const STRING_ARRAY_BORROWED = {
    type: "array" as const,
    itemType: STRING_BORROWED,
    listType: "array" as const,
    ownership: "none" as const,
};
export const CALLBACK_CLOSURE = { type: "callback" as const, trampoline: "closure" as const };

export function createLabel(text: string = "Test"): unknown {
    return call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: text }], GOBJECT);
}

export function createButton(label?: string): unknown {
    if (label !== undefined) {
        return call(GTK_LIB, "gtk_button_new_with_label", [{ type: STRING, value: label }], GOBJECT);
    }
    return call(GTK_LIB, "gtk_button_new", [], GOBJECT);
}

export function createBox(orientation: number = 0, spacing: number = 0): unknown {
    return call(
        GTK_LIB,
        "gtk_box_new",
        [
            { type: INT32, value: orientation },
            { type: INT32, value: spacing },
        ],
        GOBJECT,
    );
}

export function createScale(orientation: number = 0, min: number = 0, max: number = 100, step: number = 1): unknown {
    return call(
        GTK_LIB,
        "gtk_scale_new_with_range",
        [
            { type: INT32, value: orientation },
            { type: FLOAT64, value: min },
            { type: FLOAT64, value: max },
            { type: FLOAT64, value: step },
        ],
        GOBJECT,
    );
}

export function createProgressBar(): unknown {
    return call(GTK_LIB, "gtk_progress_bar_new", [], GOBJECT);
}

export function createGrid(): unknown {
    return call(GTK_LIB, "gtk_grid_new", [], GOBJECT);
}

export function createCancellable(): unknown {
    return call(GIO_LIB, "g_cancellable_new", [], GOBJECT);
}

export function forceGC(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

export function getRefCount(obj: unknown): number {
    return read(obj, { type: "int", size: 32, unsigned: true }, GOBJECT_REF_COUNT_OFFSET) as number;
}

interface MemoryMeasurement {
    initial: number;
    measure: () => number;
}

export function startMemoryMeasurement(): MemoryMeasurement {
    forceGC();
    const initial = process.memoryUsage().heapUsed;
    return {
        initial,
        measure: () => {
            forceGC();
            return process.memoryUsage().heapUsed - initial;
        },
    };
}

export function connectSignal(obj: unknown, signalName: string, callback: (...args: unknown[]) => void): number {
    return call(
        GOBJECT_LIB,
        "g_signal_connect_data",
        [
            { type: GOBJECT_NONE, value: obj },
            { type: STRING, value: signalName },
            { type: { type: "callback", trampoline: "closure" }, value: callback },
            { type: NULL, value: null },
            { type: NULL, value: null },
            { type: INT32, value: 0 },
        ],
        UINT64,
    ) as number;
}

export function disconnectSignal(obj: unknown, handlerId: number): void {
    call(
        GOBJECT_LIB,
        "g_signal_handler_disconnect",
        [
            { type: GOBJECT_NONE, value: obj },
            { type: UINT64, value: handlerId },
        ],
        UNDEFINED,
    );
}
