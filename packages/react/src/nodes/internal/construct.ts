import { getNativeClassByName } from "@gtkx/ffi";
import type { Container, Props } from "../../types.js";
import { camelToSnake } from "./naming.js";

/**
 * Instantiates a container widget from the React reconciler.
 *
 * Resolves the registered wrapper class for the GLib type and constructs it
 * via the generic `NativeObject` constructor. The constructor walks the JS
 * prototype chain to merge inherited props from the construction-meta
 * registry, whose keys are snake_case to match the ts-for-gir-published
 * `ConstructorProperties` shape — so we translate the camelCase JSX prop bag
 * into snake_case before construction.
 *
 * @param typeName - GLib type name (e.g. `"GtkLabel"`)
 * @param props - React prop bag; only construct-time properties are picked
 *   up, all others are ignored at construction
 */
export function createContainerWithProperties(typeName: string, props: Props): Container {
    const cls = getNativeClassByName(typeName);
    if (!cls) {
        throw new Error(`createContainerWithProperties: no registered class for GLib type '${typeName}'`);
    }
    const ffiProps: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
        ffiProps[camelToSnake(key)] = (props as Record<string, unknown>)[key];
    }
    return new (cls as new (props: Record<string, unknown>) => Container)(ffiProps);
}
