import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import { offSignal, onSignal } from "@gtkx/runtime";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { applyWrite } from "../reconciler/signals.js";
import { useLatestRef } from "./use-latest-ref.js";

type ControlledValue<P extends GObject.Object, V> = {
    signal: string;
    read: (object: P) => unknown;
    write: (object: P, value: V) => void;
    canApply?: (object: P, value: V) => boolean;
    observe?: (object: P) => Gio.ListModel;
};

const applyControlledValue = <P extends GObject.Object, V>(
    object: P | null,
    value: V | undefined,
    prop: string,
    operations: ControlledValue<P, V>,
): void => {
    if (object === null || value === undefined || Object.is(operations.read(object), value)) {
        return;
    }

    if (operations.canApply !== undefined && !operations.canApply(object, value)) {
        return;
    }

    applyWrite(prop, () => {
        operations.write(object, value);
    });
};

const useControlledValue = <P extends GObject.Object, V>(
    objectRef: RefObject<P | null>,
    value: V | undefined,
    prop: string,
    operations: ControlledValue<P, V>,
): (() => void) => {
    const valueRef = useLatestRef(value);
    const scheduled = useRef(false);
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
            scheduled.current = false;
            settle();
        });
    }, [settle]);

    useLayoutEffect(settle);
    useLayoutEffect(() => {
        const instance = objectRef.current;

        if (instance === null || !isControlled) {
            return;
        }

        const children = operations.observe?.(instance);
        onSignal(instance, operations.signal, schedule);

        if (children !== undefined) {
            onSignal(children, "items-changed", schedule);
        }

        return () => {
            offSignal(instance, operations.signal, schedule);

            if (children !== undefined) {
                offSignal(children, "items-changed", schedule);
            }
        };
    }, [objectRef, isControlled, operations, schedule]);

    return schedule;
};

export { useControlledValue, type ControlledValue };
