/**
 * Tracks the wrapper currently being constructed by {@link constructGObjectInstance}.
 *
 * GObject fires class vfuncs synchronously from inside `g_object_new`, so a
 * subclass that overrides `constructed` runs JavaScript while the wrapper
 * returned by `new MyWidget(...)` is still mid-construction: the handle has
 * not yet been assigned and the identity registry does not yet know about it.
 * Without this slot, the vfunc trampoline's identity lookup falls back to
 * `Object.create(cls.prototype)`, producing a second wrapper that skips JS
 * class field initializers and is invisible to user code.
 *
 * `constructGObjectInstance` writes the wrapper here for the duration of
 * `g_object_new`, save-and-restore so nested constructions stack. The identity
 * lookup in `getNativeObject` reads this slot first and adopts the in-flight
 * wrapper instead of synthesizing a new one.
 *
 * The slot is plain mutable state because the JavaScript event loop is
 * single-threaded and the native dispatch returns vfunc callbacks back to that
 * same thread.
 */

let pending: object | null = null;

/**
 * Replaces the in-flight construction wrapper with `instance` and returns the
 * previous value so callers can restore it.
 */
export function setPendingConstruction(instance: object | null): object | null {
    const previous = pending;
    pending = instance;
    return previous;
}

/**
 * Returns the wrapper currently being constructed, or `null` when no
 * construction is in flight.
 */
export function getPendingConstruction(): object | null {
    return pending;
}
