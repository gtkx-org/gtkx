/**
 * Persistent per-instance state for `registerClass` subclasses.
 *
 * A `registerClass` subclass that needs JavaScript state which survives garbage
 * collection of its wrapper stores it under `this.state`. That single object —
 * and only that object — is persisted, keyed by the GObject's pointer id, for
 * exactly as long as the GObject itself lives:
 *
 * ```tsx
 * class NameObject extends GObject.Object {
 *     declare state: { name: string };
 * }
 * registerClass(NameObject);
 * const item = new NameObject();
 * item.state.name = "Drop";
 * ```
 *
 * The identity registry holds wrappers only weakly, so when a wrapper is
 * collected while its GObject lives on — held by a native container such as a
 * `Gio.ListStore` — a later re-wrap via {@link getNativeObject} produces a fresh
 * instance. {@link linkInstanceState} points that fresh instance's `this.state`
 * back at the same persisted object, so the state is preserved. The object holds
 * only plain data (never the native handle), so it never keeps the GObject
 * alive; a native finalize notify evicts the entry when the GObject is
 * destroyed, bounding the registry and guarding against pointer-address reuse.
 */

import { getNativeId, type NativeHandle, onObjectFinalized, watchObjectFinalize } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

const instanceStateRegistry = new Map<number, Record<string, unknown>>();
const statefulClasses = new WeakSet<AnyClass>();

onObjectFinalized((pointerId) => {
    instanceStateRegistry.delete(pointerId);
});

/**
 * Marks `cls` as a wrapper class whose instances expose persistent `this.state`.
 *
 * Called by {@link registerClass} for every user-registered subclass.
 *
 * @param cls - The registered subclass
 */
export function markStatefulClass(cls: AnyClass): void {
    statefulClasses.add(cls);
}

/**
 * Points `instance.state` at the persisted state object for its GObject, creating
 * the entry (and arming the finalize watch) the first time the object is seen.
 *
 * A no-op for wrappers whose class is not a registered subclass. Called at
 * construction and on every re-wrap so a freshly created instance shares the
 * same `state` object as the original.
 *
 * @param handle - The wrapper's native handle
 * @param instance - The wrapper to link
 */
export function linkInstanceState(handle: NativeHandle, instance: object): void {
    if (!statefulClasses.has(instance.constructor as AnyClass)) return;
    const pointerId = getNativeId(handle);
    let state = instanceStateRegistry.get(pointerId);
    if (state === undefined) {
        state = {};
        instanceStateRegistry.set(pointerId, state);
        watchObjectFinalize(handle);
    }
    Object.defineProperty(instance, "state", { value: state, enumerable: false, configurable: true });
}
