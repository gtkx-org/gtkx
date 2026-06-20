import type * as GObject from "@gtkx/gi/gobject";
import { useLayoutEffect, useRef } from "react";
import { type GObjectTarget, resolveGobjectTarget } from "./gobject-target.js";

/**
 * The attach/detach/identity operations a {@link useTargetRegistration} caller
 * supplies. `R` is the per-hook registration record; `T` is the resolved target.
 */
export interface TargetRegistrationOps<T extends GObject.Object, R> {
    /**
     * Subscribes against `target` and returns the registration record. The
     * `clearIfCurrent` callback nulls the stored registration only when it still
     * holds the passed record, letting a self-terminating subscription forget
     * itself without racing a later re-attach.
     */
    attach(target: T, clearIfCurrent: (registration: R) => void): R;
    /** Unsubscribes the registration record. */
    detach(registration: R): void;
    /** Whether `registration` still matches `target` (and any closed-over options). */
    isSame(registration: R, target: T): boolean;
}

/**
 * The follow-the-ref subscription skeleton shared by {@link useSignal} and
 * {@link useTickCallback}: it owns the registration ref, re-resolves the target
 * every render, re-subscribes only when the resolved target (or a closed-over
 * option) diverges from the live registration, and tears down on unmount.
 *
 * The caller keeps its own per-render callback ref and closes over it in
 * `attach`, so changing the callback never re-subscribes; only an identity
 * change detected by `isSame` does.
 *
 * @typeParam T - The resolved target object type.
 * @typeParam R - The per-hook registration record.
 * @param target - The object to subscribe to, a ref holding it, or null/undefined to disable.
 * @param ops - The attach/detach/identity operations.
 */
export const useTargetRegistration = <T extends GObject.Object, R>(
    target: GObjectTarget<T>,
    ops: TargetRegistrationOps<T, R>,
): void => {
    const registrationRef = useRef<R | null>(null);

    const drop = (): void => {
        const registration = registrationRef.current;
        if (registration !== null) {
            ops.detach(registration);
            registrationRef.current = null;
        }
    };

    const clearIfCurrent = (registration: R): void => {
        if (registrationRef.current === registration) registrationRef.current = null;
    };

    useLayoutEffect(() => {
        const resolved = resolveGobjectTarget(target);
        const registration = registrationRef.current;
        if (registration !== null && resolved !== null && ops.isSame(registration, resolved)) return;
        drop();
        if (resolved === null) return;
        registrationRef.current = ops.attach(resolved, clearIfCurrent);
    });

    useLayoutEffect(() => () => drop(), []);
};
