import type { GirFunction } from "../gir/function.js";

/**
 * Reports whether `fn` declares `throws=1` and therefore needs a
 * `createRef(null)` / `checkError(error, GLib.Error)` wrapper around its
 * FFI call.
 *
 * Wraps the predicate so the class writer can branch on a single import
 * from this module rather than reading the GIR flag directly.
 *
 * @param fn - The callable
 */
export const requiresGErrorWrapper = (fn: GirFunction): boolean => fn.throws;
