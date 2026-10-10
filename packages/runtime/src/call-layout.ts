import type { CallLayout } from "@gtkx/native";
import type { Descriptor } from "./descriptor-types.js";

const argumentCount = (descriptor: Descriptor): number =>
    descriptor.kind === "callback"
        ? 1 + Number(descriptor.hasUserData === true) + Number(descriptor.hasDestroy === true)
        : 1;

const callLayout = (descriptors: Descriptor[], fixedArgCount?: number): CallLayout => {
    if (
        fixedArgCount !== undefined &&
        (!Number.isInteger(fixedArgCount) || fixedArgCount < 0 || fixedArgCount > descriptors.length)
    ) {
        throw new RangeError("fixedArgCount must be an argument descriptor count");
    }

    const count = descriptors.reduce((total, descriptor) => total + argumentCount(descriptor), 0);
    const reserved = new Map<number, number>();
    const sequential: number[] = [];
    let source = 0;

    for (const descriptor of descriptors) {
        sequential.push(source++);
        if (descriptor.kind !== "callback") {
            continue;
        }
        const extras: [boolean, number | undefined][] = [
            [descriptor.hasUserData === true, descriptor.userDataArgIndex],
            [descriptor.hasDestroy === true, descriptor.destroyArgIndex],
        ];
        for (const [present, target] of extras) {
            if (!present) {
                if (target !== undefined) {
                    throw new TypeError("A callback position requires its matching argument");
                }
                continue;
            }
            if (target === undefined) {
                sequential.push(source++);
                continue;
            }
            if (!Number.isInteger(target) || target < 0 || target >= count) {
                throw new RangeError("Callback argument position exceeds the native signature");
            }
            if (reserved.has(target)) {
                throw new TypeError("Callback argument positions overlap");
            }
            reserved.set(target, source++);
        }
    }

    const remaining = sequential.values();
    const argOrder = Array.from({ length: count }, (_, index) => {
        const source = reserved.get(index) ?? remaining.next().value;
        if (source === undefined) {
            throw new TypeError("Incomplete callback argument layout");
        }

        return source;
    });

    const layout: CallLayout = { argOrder };
    if (fixedArgCount !== undefined) {
        layout.fixedArgCount = descriptors
            .slice(0, fixedArgCount)
            .reduce((total, descriptor) => total + argumentCount(descriptor), 0);
    }

    return layout;
};

export { callLayout };
