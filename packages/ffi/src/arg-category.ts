import type { RefType, Type } from "@gtkx/native";

/**
 * The single source of truth for classifying an argument by its data-flow
 * direction. The function-call path ({@link "./fn.js"}), the signal-emit path
 * ({@link "./signal.js"}), and the callback path ({@link "./callback.js"}) all
 * classify through this module so the in/out/inout/caller-allocated taxonomy is
 * defined once.
 *
 * Only the classification is shared. The directional marshalling on either side
 * of the boundary is a genuine inverse — a function call writes native inputs
 * then reads back out-cells, whereas a callback reads native inputs then writes
 * back out-cells — so each path keeps its own per-argument toNative/fromNative
 * and read-back/write-back behavior rather than forcing those mirror halves
 * together.
 */

export type ArgCategory =
    | { kind: "plainInput" }
    | { kind: "outCell"; inout: boolean }
    | { kind: "callerAllocated"; inout: boolean };

export type ArgDirectionMeta = {
    direction?: "out" | "inout" | undefined;
    callerAllocated: boolean;
};

export const classifyArgCategory = (meta: ArgDirectionMeta): ArgCategory => {
    if (meta.direction === undefined) return { kind: "plainInput" };
    const inout = meta.direction === "inout";
    return meta.callerAllocated ? { kind: "callerAllocated", inout } : { kind: "outCell", inout };
};

export const isOutCellType = (descriptor: Type): descriptor is RefType => descriptor.type === "ref";

const isCallerAllocatedBufferType = (descriptor: Type): boolean =>
    (descriptor.type === "boxed" || descriptor.type === "struct") && descriptor.callerAllocated === true;

const directionMetaOfType = (descriptor: Type): ArgDirectionMeta => {
    if (isOutCellType(descriptor))
        return { direction: descriptor.inout === true ? "inout" : "out", callerAllocated: false };
    if (isCallerAllocatedBufferType(descriptor)) return { direction: "out", callerAllocated: true };
    return { callerAllocated: false };
};

/**
 * Classify a native type descriptor whose data-flow direction is encoded
 * structurally: a `ref` descriptor is an out-cell (inout when its `inout` flag
 * is set), and a caller-allocated boxed/struct is a caller-allocated output
 * buffer. Everything else is a plain input.
 */
export const categoryOfType = (descriptor: Type): ArgCategory => classifyArgCategory(directionMetaOfType(descriptor));
