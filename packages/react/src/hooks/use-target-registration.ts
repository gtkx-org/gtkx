import type * as GObject from "@gtkx/gi/gobject";
import { useLayoutEffect, useRef } from "react";
import { type GObjectTarget, resolveGObjectTarget } from "../utils/gobject-target.js";

type TargetRegistrationOps<T extends GObject.Object, R> = {
    attach(target: T, clearIfCurrent: (registration: R) => void): R;
    detach(registration: R): void;
    isSame(registration: R, target: T): boolean;
};

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
        const resolved = resolveGObjectTarget(target);
        const registration = registrationRef.current;
        if (registration !== null && resolved !== null && ops.isSame(registration, resolved)) return;
        drop();
        if (resolved === null) return;
        registrationRef.current = ops.attach(resolved, clearIfCurrent);
    });

    useLayoutEffect(() => () => drop(), []);
};
