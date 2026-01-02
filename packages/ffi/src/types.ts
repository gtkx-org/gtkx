import type { Type } from "@gtkx/native";

/**
 * Signal metadata for a single signal.
 */
export type SignalMetaEntry = {
    params: Type[];
    returnType?: Type;
};

/**
 * Widget metadata structure.
 * Contains generic FFI metadata for widgets.
 * React-specific classification is derived from internal.ts constants in React.
 */
export type WidgetMeta = {
    /** Widget can contain children */
    isContainer: boolean;
    /** Named slots for child widgets */
    slots: readonly string[];
    /** Property names that can be set as props */
    propNames: readonly string[];
    /** Signal metadata for this class (own signals only, not inherited) */
    signals: Record<string, SignalMetaEntry>;
};

/**
 * Runtime widget metadata structure.
 * This is the shape of the WIDGET_META constant in generated FFI classes.
 * Uses unknown[] for signal params since they're runtime values from @gtkx/native.
 */
export type RuntimeWidgetMeta = {
    /** Widget can contain children */
    isContainer: boolean;
    /** Named slots for child widgets */
    slots: readonly string[];
    /** Property names that can be set as props */
    propNames: readonly string[];
    /** Signal metadata for this class (own signals only, not inherited) */
    signals: Record<string, { params: unknown[]; returnType?: unknown }>;
};

/**
 * Interface for classes that have WIDGET_META.
 */
interface ClassWithWidgetMeta {
    WIDGET_META?: WidgetMeta;
}

/**
 * Resolves signal metadata by walking up the prototype chain.
 * Each class only stores its own signals in WIDGET_META.signals,
 * so we need to walk up to find inherited signals.
 *
 * @param ctor - The class constructor to start from
 * @param signalName - The signal name to look up
 * @returns The signal metadata if found, undefined otherwise
 *
 * @example
 * ```typescript
 * // In generated connect method:
 * const meta = resolveSignalMeta(this.constructor, signal);
 * if (meta) {
 *   // Use meta.params and meta.returnType for marshalling
 * }
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: Function is correct here - we walk prototype chains at runtime where TypeScript cannot statically know constructor types
export function resolveSignalMeta(ctor: Function, signalName: string): SignalMetaEntry | null {
    // biome-ignore lint/complexity/noBannedTypes: Walking prototype chain requires Function type
    let current: Function | null = ctor;

    while (current) {
        const meta = (current as unknown as ClassWithWidgetMeta).WIDGET_META;
        if (meta?.signals?.[signalName]) {
            return meta.signals[signalName];
        }

        const prototype = Object.getPrototypeOf(current.prototype);
        current = prototype?.constructor ?? null;

        if (current === Object || current === Function) {
            break;
        }
    }

    return null;
}
