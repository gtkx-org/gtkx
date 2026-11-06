import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import { offSignal, onSignal } from "@gtkx/runtime";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { applyWrite } from "../reconciler/signals.js";
import { describeElement, isDevelopment, typeNameOf, warnDismissal } from "../utils/dismissal.js";
import { useLatestRef } from "./use-latest-ref.js";

type ControlledValue<P extends GObject.Object, V> = {
    signal: string;
    read: (object: P) => unknown;
    write: (object: P, value: V) => void;
    canApply?: (object: P, value: V) => boolean;
    observe?: (object: P) => Gio.ListModel;
    /** The handler prop that reports the user's change; restoring a value the user dismissed then warns. */
    dismissedThrough?: string;
};

const applyControlledValue = <P extends GObject.Object, V>(
    object: P | null,
    value: V | undefined,
    prop: string,
    operations: ControlledValue<P, V>,
): boolean => {
    if (object === null || value === undefined || Object.is(operations.read(object), value)) {
        return false;
    }

    if (operations.canApply !== undefined && !operations.canApply(object, value)) {
        return false;
    }

    applyWrite(prop, () => {
        operations.write(object, value);
    });

    return true;
};

const warnRestored = (object: GObject.Object, prop: string, value: unknown, handler: string): void => {
    warnDismissal(
        `${typeNameOf(object)}:${prop}`,
        `The user changed ${prop} on ${describeElement(object, {})} to ${String(!value)}, but the app still ` +
            `renders ${prop}={${String(value)}}, so GTKX restored it. Update the value from ${handler}, or leave ` +
            `${prop} out to let the widget manage it.`,
    );
};

const useControlledValue = <P extends GObject.Object, V>(
    objectRef: RefObject<P | null>,
    value: V | undefined,
    prop: string,
    operations: ControlledValue<P, V>,
): (() => void) => {
    const valueRef = useLatestRef(value);
    const scheduled = useRef(false);
    const isUserChange = useRef(false);
    const isControlled = value !== undefined;
    const settle = useCallback(() => {
        applyControlledValue(objectRef.current, valueRef.current, prop, operations);
    }, [objectRef, valueRef, prop, operations]);
    const schedule = useCallback(() => {
        if (scheduled.current) {
            return;
        }

        scheduled.current = true;
        queueMicrotask(() => {
            const object = objectRef.current;
            const isRestore = isUserChange.current;
            scheduled.current = false;
            isUserChange.current = false;

            if (
                applyControlledValue(object, valueRef.current, prop, operations) &&
                isRestore &&
                object !== null &&
                operations.dismissedThrough !== undefined &&
                isDevelopment()
            ) {
                warnRestored(object, prop, valueRef.current, operations.dismissedThrough);
            }
        });
    }, [objectRef, valueRef, prop, operations]);
    const onChange = useCallback(() => {
        isUserChange.current = true;
        schedule();
    }, [schedule]);

    useLayoutEffect(settle);
    useLayoutEffect(() => {
        const instance = objectRef.current;

        if (instance === null || !isControlled) {
            return;
        }

        const children = operations.observe?.(instance);
        onSignal(instance, operations.signal, onChange);

        if (children !== undefined) {
            onSignal(children, "items-changed", schedule);
        }

        return () => {
            offSignal(instance, operations.signal, onChange);

            if (children !== undefined) {
                offSignal(children, "items-changed", schedule);
            }
        };
    }, [objectRef, isControlled, operations, schedule, onChange]);

    return schedule;
};

export { useControlledValue, type ControlledValue };
