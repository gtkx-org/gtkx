import type { Descriptor, Value } from "../../binding.js";
import { alloc, bind, type Handle, call as nativeCall, read, write } from "../../binding.js";

/**
 * Test convenience over the bound FFI call: binds a one-shot descriptor from the per-argument types
 * and invokes it with the values, so marshalling tests can pass `{ type, value }` arguments
 * directly.
 */
export function callArgs(
    sharedLibrary: string,
    symbol: string,
    args: { type: Descriptor; value: Value }[],
    returnDescriptor: Descriptor,
): Value {
    const descriptor = bind(
        sharedLibrary,
        symbol,
        args.map((arg) => arg.type),
        returnDescriptor,
    );
    return nativeCall(
        descriptor,
        args.map((arg) => arg.value),
    );
}

const GOBJECT_REF_COUNT_OFFSET = 8;

export const GTK_LIB = "libgtk-4.so.1";
export const GDK_LIB = "libgtk-4.so.1";
export const GOBJECT_LIB = "libgobject-2.0.so.0";
export const GIO_LIB = "libgio-2.0.so.0";
export const PANGO_LIB = "libpango-1.0.so.0";
export const INT8 = { kind: "int8" as const };
export const INT16 = { kind: "int16" as const };
export const INT32 = { kind: "int32" as const };
export const INT64 = { kind: "int64" as const };
export const UINT8 = { kind: "uint8" as const };
export const UINT16 = { kind: "uint16" as const };
export const UINT32 = { kind: "uint32" as const };
export const UINT64 = { kind: "uint64" as const };
export const BIGUINT64 = { kind: "biguint64" as const };
export const FLOAT32 = { kind: "float32" as const };
export const FLOAT64 = { kind: "float64" as const };
export const BOOLEAN = { kind: "boolean" as const };
export const STRING = { kind: "string" as const, ownership: "full" as const };
export const STRING_BORROWED = { kind: "string" as const, ownership: "borrowed" as const };
export const OBJECT = { kind: "object" as const, ownership: "full" as const };
export const OBJECT_BORROWED = { kind: "object" as const, ownership: "borrowed" as const };
export const POINTER = { kind: "uint64" as const };
export const VOID = { kind: "void" as const };
export const STRING_ARRAY = {
    kind: "array" as const,
    itemDescriptor: STRING,
    arrayKind: "array" as const,
    ownership: "full" as const,
};

export function createLabel(text: string = "Test"): Value {
    return callArgs(GTK_LIB, "gtk_label_new", [{ type: STRING, value: text }], OBJECT);
}

export function createButton(label?: string): Value {
    if (label !== undefined) {
        return callArgs(GTK_LIB, "gtk_button_new_with_label", [{ type: STRING, value: label }], OBJECT);
    }
    return callArgs(GTK_LIB, "gtk_button_new", [], OBJECT);
}

export function createBox(orientation: number = 0, spacing: number = 0): Value {
    return callArgs(
        GTK_LIB,
        "gtk_box_new",
        [
            { type: INT32, value: orientation },
            { type: INT32, value: spacing },
        ],
        OBJECT,
    );
}

export function createScale(orientation: number = 0, min: number = 0, max: number = 100, step: number = 1): Value {
    return callArgs(
        GTK_LIB,
        "gtk_scale_new_with_range",
        [
            { type: INT32, value: orientation },
            { type: FLOAT64, value: min },
            { type: FLOAT64, value: max },
            { type: FLOAT64, value: step },
        ],
        OBJECT,
    );
}

export function createProgressBar(): Value {
    return callArgs(GTK_LIB, "gtk_progress_bar_new", [], OBJECT);
}

export function createGrid(): Value {
    return callArgs(GTK_LIB, "gtk_grid_new", [], OBJECT);
}

export function createCancellable(): Value {
    return callArgs(GIO_LIB, "g_cancellable_new", [], OBJECT);
}

export const typeFromName = (name: string): bigint =>
    callArgs(GOBJECT_LIB, "g_type_from_name", [{ type: STRING_BORROWED, value: name }], BIGUINT64) as bigint;

export function forceGC(): void {
    if (!global.gc) {
        throw new Error("global.gc is not available. Run tests with --expose-gc flag.");
    }
    global.gc();
}

export function getRefCount(obj: unknown): number {
    return read(obj as Handle, { kind: "uint32" }, GOBJECT_REF_COUNT_OFFSET) as number;
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
    returnDescriptor: Descriptor,
): unknown {
    return callArgs(
        GOBJECT_LIB,
        "g_signal_connect_data",
        [
            { type: OBJECT_BORROWED, value: obj as Handle },
            { type: STRING, value: signalName },
            {
                type: {
                    kind: "callback",
                    argDescriptors: [OBJECT_BORROWED, UINT64],
                    returnDescriptor: { kind: "void" },
                    hasDestroy: true,
                    userDataIndex: 1,
                },
                value: callback as (...args: Value[]) => Value,
            },
            { type: INT32, value: 0 },
        ],
        returnDescriptor,
    );
}

export function connectSignalCallback(
    obj: unknown,
    signalName: string,
    callback: (...args: unknown[]) => void,
    options: { argDescriptors: Descriptor[]; userDataIndex: number; hasDestroy?: boolean } = {
        argDescriptors: [{ kind: "object", ownership: "borrowed" }, { kind: "uint64" }],
        userDataIndex: 1,
        hasDestroy: true,
    },
): number {
    return callArgs(
        GOBJECT_LIB,
        "g_signal_connect_data",
        [
            { type: OBJECT_BORROWED, value: obj as Handle },
            { type: STRING, value: signalName },
            {
                type: {
                    kind: "callback",
                    argDescriptors: options.argDescriptors,
                    returnDescriptor: { kind: "void" },
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
    callArgs(
        GOBJECT_LIB,
        "g_signal_handler_disconnect",
        [
            { type: OBJECT_BORROWED, value: obj },
            { type: UINT64, value: handlerId },
        ],
        VOID,
    );
}

export function boxAppend(box: Value, child: Value): void {
    callArgs(
        GTK_LIB,
        "gtk_box_append",
        [
            { type: OBJECT_BORROWED, value: box },
            { type: OBJECT_BORROWED, value: child },
        ],
        VOID,
    );
}

export function boxRemove(box: Value, child: Value): void {
    callArgs(
        GTK_LIB,
        "gtk_box_remove",
        [
            { type: OBJECT_BORROWED, value: box },
            { type: OBJECT_BORROWED, value: child },
        ],
        VOID,
    );
}

export function getFirstChild(widget: Value): Value {
    return callArgs(
        GTK_LIB,
        "gtk_widget_get_first_child",
        [{ type: OBJECT_BORROWED, value: widget }],
        OBJECT_BORROWED,
    );
}

export function getNextSibling(widget: Value): Value {
    return callArgs(
        GTK_LIB,
        "gtk_widget_get_next_sibling",
        [{ type: OBJECT_BORROWED, value: widget }],
        OBJECT_BORROWED,
    );
}

export function getParent(widget: Value): Value {
    return callArgs(GTK_LIB, "gtk_widget_get_parent", [{ type: OBJECT_BORROWED, value: widget }], OBJECT_BORROWED);
}

const INT32_REF = { kind: "ref" as const, innerDescriptor: INT32 };

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
    callArgs(
        GTK_LIB,
        "gtk_widget_measure",
        [
            { type: OBJECT_BORROWED, value: options.widget },
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
    return callArgs(
        GTK_LIB,
        "gtk_widget_measure",
        [
            { type: OBJECT_BORROWED, value: widget },
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
    return callArgs(
        GOBJECT_LIB,
        "g_signal_handler_is_connected",
        [
            { type: OBJECT_BORROWED, value: obj },
            { type: UINT64, value: handlerId },
        ],
        BOOLEAN,
    ) as boolean;
}

const BOXED_SIZE = 16;

export type RectangleFields = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type RgbaChannels = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

export function allocRectangle(): Handle {
    return alloc(BOXED_SIZE, "GdkRectangle");
}

export function allocRgba(): Handle {
    return alloc(BOXED_SIZE, "GdkRGBA");
}

export function writeRectangleFields(rect: Handle, fields: RectangleFields): void {
    write(rect, INT32, 0, fields.x);
    write(rect, INT32, 4, fields.y);
    write(rect, INT32, 8, fields.width);
    write(rect, INT32, 12, fields.height);
}

export function readRectangleFields(rect: Handle): RectangleFields {
    return {
        x: read(rect, INT32, 0) as number,
        y: read(rect, INT32, 4) as number,
        width: read(rect, INT32, 8) as number,
        height: read(rect, INT32, 12) as number,
    };
}

export function writeRgbaChannels(rgba: Handle, channels: RgbaChannels): void {
    write(rgba, FLOAT32, 0, channels.red);
    write(rgba, FLOAT32, 4, channels.green);
    write(rgba, FLOAT32, 8, channels.blue);
    write(rgba, FLOAT32, 12, channels.alpha);
}

export function readRgbaChannels(rgba: Handle): RgbaChannels {
    return {
        red: read(rgba, FLOAT32, 0) as number,
        green: read(rgba, FLOAT32, 4) as number,
        blue: read(rgba, FLOAT32, 8) as number,
        alpha: read(rgba, FLOAT32, 12) as number,
    };
}
