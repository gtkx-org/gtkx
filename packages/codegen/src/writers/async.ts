import type { GirFunction } from "../gir/function.js";

/**
 * Detects the start half of a `Gio.AsyncReady` callable pair.
 *
 * Pairs follow two GIR conventions: an explicit `*_async` / `*_finish`
 * suffix (the older style), or a base name paired with a `<root>_finish`
 * (the modern GTK 4 style, e.g. `gtk_file_dialog_open` /
 * `gtk_file_dialog_open_finish`).
 *
 * The runtime convention is to wrap the pair with `promisify(asyncFn,
 * finishFn, cancellable, { leading })`. This detector returns the
 * matching finish counterpart's GIR name when one exists in the same
 * set of callables, so the class writer can wire the wrapper.
 *
 * @param fn - The candidate async-start callable
 * @param siblings - Other callables on the same type to scan for the
 *     matching `*_finish`
 * @returns The matching `*_finish` GIR name, or `undefined` when there is
 *     no pair
 */
export const matchAsyncFinishName = (fn: GirFunction, siblings: readonly GirFunction[]): string | undefined => {
    if (fn.name.endsWith("_async")) {
        const root = fn.name.slice(0, -"_async".length);
        const finishName = `${root}_finish`;
        const match = siblings.find((sibling) => sibling.name === finishName);
        return match === undefined ? undefined : finishName;
    }
    if (fn.name.endsWith("_finish")) return undefined;
    const finishName = `${fn.name}_finish`;
    const match = siblings.find((sibling) => sibling.name === finishName);
    if (match === undefined) return undefined;
    if (!hasAsyncReadyCallbackParameter(fn)) return undefined;
    return finishName;
};

const hasAsyncReadyCallbackParameter = (fn: GirFunction): boolean => {
    for (const parameter of fn.parameters) {
        if (parameter.scope !== undefined) return true;
        if (parameter.type?.kind !== "named") continue;
        if (parameter.type.typeName === "AsyncReadyCallback") return true;
    }
    return false;
};
