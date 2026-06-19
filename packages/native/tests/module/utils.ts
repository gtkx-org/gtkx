import { call, type Handle, read } from "../../index.js";
import type { Type, Value } from "../../types.js";

const GOBJECT_REF_COUNT_OFFSET = 8;

export const GTK_LIB = "libgtk-4.so.1";
export const GDK_LIB = "libgtk-4.so.1";
export const GOBJECT_LIB = "libgobject-2.0.so.0";
export const GIO_LIB = "libgio-2.0.so.0";
export const PANGO_LIB = "libpango-1.0.so.0";
export const INT8 = { type: "int8" as const };
export const INT16 = { type: "int16" as const };
export const INT32 = { type: "int32" as const };
export const INT64 = { type: "int64" as const };
export const UINT8 = { type: "uint8" as const };
export const UINT16 = { type: "uint16" as const };
export const UINT32 = { type: "uint32" as const };
export const UINT64 = { type: "uint64" as const };
export const BIGUINT64 = { type: "biguint64" as const };
export const FLOAT32 = { type: "float32" as const };
export const FLOAT64 = { type: "float64" as const };
export const BOOLEAN = { type: "boolean" as const };
export const STRING = { type: "string" as const, ownership: "full" as const };
export const STRING_BORROWED = { type: "string" as const, ownership: "borrowed" as const };
export const GOBJECT = { type: "gobject" as const, ownership: "full" as const };
export const GOBJECT_BORROWED = { type: "gobject" as const, ownership: "borrowed" as const };
export const POINTER = { type: "uint64" as const };
export const VOID = { type: "void" as const };
export const STRING_ARRAY = {
    type: "array" as const,
    itemType: STRING,
    kind: "array" as const,
    ownership: "full" as const,
};

export function createLabel(text: string = "Test"): Value {
    return call(GTK_LIB, "gtk_label_new", [{ type: STRING, value: text }], GOBJECT);
}

export function createButton(label?: string): Value {
    if (label !== undefined) {
        return call(GTK_LIB, "gtk_button_new_with_label", [{ type: STRING, value: label }], GOBJECT);
    }
    return call(GTK_LIB, "gtk_button_new", [], GOBJECT);
}

export function createBox(orientation: number = 0, spacing: number = 0): Value {
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

export function createScale(orientation: number = 0, min: number = 0, max: number = 100, step: number = 1): Value {
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

export function createProgressBar(): Value {
    return call(GTK_LIB, "gtk_progress_bar_new", [], GOBJECT);
}

export function createGrid(): Value {
    return call(GTK_LIB, "gtk_grid_new", [], GOBJECT);
}

export function createCancellable(): Value {
    return call(GIO_LIB, "g_cancellable_new", [], GOBJECT);
}

export const typeFromName = (name: string): bigint =>
    call(GOBJECT_LIB, "g_type_from_name", [{ type: STRING_BORROWED, value: name }], BIGUINT64) as bigint;

export function forceGC(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

export function getRefCount(obj: unknown): number {
    return read(obj as Handle, { type: "uint32" }, GOBJECT_REF_COUNT_OFFSET) as number;
}

type MemoryMeasurement = {
    initial: number;
    measure: () => number;
};

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
    return connectSignalReturning(obj, signalName, callback, UINT64) as number;
}

export function connectSignalReturning(
    obj: unknown,
    signalName: string,
    callback: (...args: unknown[]) => void,
    returnType: Type,
): unknown {
    return call(
        GOBJECT_LIB,
        "g_signal_connect_data",
        [
            { type: GOBJECT_BORROWED, value: obj as Handle },
            { type: STRING, value: signalName },
            {
                type: {
                    type: "callback",
                    argTypes: [GOBJECT_BORROWED, UINT64],
                    returnType: { type: "void" },
                    hasDestroy: true,
                    userDataIndex: 1,
                },
                value: callback as (...args: Value[]) => Value,
            },
            { type: INT32, value: 0 },
        ],
        returnType,
    );
}

export function connectSignalCallback(
    obj: unknown,
    signalName: string,
    callback: (...args: unknown[]) => void,
    options: { argTypes: Type[]; userDataIndex: number; hasDestroy?: boolean } = {
        argTypes: [{ type: "gobject", ownership: "borrowed" }, { type: "uint64" }],
        userDataIndex: 1,
        hasDestroy: true,
    },
): number {
    return call(
        GOBJECT_LIB,
        "g_signal_connect_data",
        [
            { type: GOBJECT_BORROWED, value: obj as Handle },
            { type: STRING, value: signalName },
            {
                type: {
                    type: "callback",
                    argTypes: options.argTypes,
                    returnType: { type: "void" },
                    hasDestroy: options.hasDestroy ?? true,
                    userDataIndex: options.userDataIndex,
                },
                value: callback as (...args: Value[]) => Value,
            },
            { type: INT32, value: 0 },
        ],
        UINT64,
    ) as number;
}

export function disconnectSignal(obj: Value, handlerId: number): void {
    call(
        GOBJECT_LIB,
        "g_signal_handler_disconnect",
        [
            { type: GOBJECT_BORROWED, value: obj },
            { type: UINT64, value: handlerId },
        ],
        VOID,
    );
}

export function boxAppend(box: Value, child: Value): void {
    call(
        GTK_LIB,
        "gtk_box_append",
        [
            { type: GOBJECT_BORROWED, value: box },
            { type: GOBJECT_BORROWED, value: child },
        ],
        VOID,
    );
}

export function boxRemove(box: Value, child: Value): void {
    call(
        GTK_LIB,
        "gtk_box_remove",
        [
            { type: GOBJECT_BORROWED, value: box },
            { type: GOBJECT_BORROWED, value: child },
        ],
        VOID,
    );
}

export function getFirstChild(widget: Value): Value {
    return call(GTK_LIB, "gtk_widget_get_first_child", [{ type: GOBJECT_BORROWED, value: widget }], GOBJECT_BORROWED);
}

export function getNextSibling(widget: Value): Value {
    return call(GTK_LIB, "gtk_widget_get_next_sibling", [{ type: GOBJECT_BORROWED, value: widget }], GOBJECT_BORROWED);
}

export function getParent(widget: Value): Value {
    return call(GTK_LIB, "gtk_widget_get_parent", [{ type: GOBJECT_BORROWED, value: widget }], GOBJECT_BORROWED);
}

const INT32_REF = { type: "ref" as const, innerType: INT32 };

function measureSlot(
    ref: { value: number } | null,
): { type: typeof INT32_REF; value: { value: number } } | { type: typeof POINTER; value: 0 } {
    if (ref === null) return { type: POINTER, value: 0 };
    return { type: INT32_REF, value: ref };
}

export type MeasureWidgetOptions = {
    widget: Value;
    orientation: number;
    forSize: number;
    minRef?: { value: number } | null;
    naturalRef?: { value: number } | null;
    minBaselineRef?: { value: number } | null;
    naturalBaselineRef?: { value: number } | null;
};

export function measureWidget(options: MeasureWidgetOptions): void {
    call(
        GTK_LIB,
        "gtk_widget_measure",
        [
            { type: GOBJECT_BORROWED, value: options.widget },
            { type: INT32, value: options.orientation },
            { type: INT32, value: options.forSize },
            measureSlot(options.minRef ?? null),
            measureSlot(options.naturalRef ?? null),
            measureSlot(options.minBaselineRef ?? null),
            measureSlot(options.naturalBaselineRef ?? null),
        ],
        VOID,
    );
}

export function measureWidgetAllNull(widget: Value): unknown {
    return call(
        GTK_LIB,
        "gtk_widget_measure",
        [
            { type: GOBJECT_BORROWED, value: widget },
            { type: INT32, value: 0 },
            { type: INT32, value: -1 },
            { type: POINTER, value: 0 },
            { type: POINTER, value: 0 },
            { type: POINTER, value: 0 },
            { type: POINTER, value: 0 },
        ],
        VOID,
    );
}

export function isSignalHandlerConnected(obj: Value, handlerId: number): boolean {
    return call(
        GOBJECT_LIB,
        "g_signal_handler_is_connected",
        [
            { type: GOBJECT_BORROWED, value: obj },
            { type: UINT64, value: handlerId },
        ],
        BOOLEAN,
    ) as boolean;
}
