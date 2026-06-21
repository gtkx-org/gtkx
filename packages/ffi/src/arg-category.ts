/**
 * Directional classification of a single FFI argument, shared by the three
 * marshalling directions: C calls (`fn.ts`), callback trampolines
 * (`handler-trampoline.ts`), and signal emission (`signal.ts`).
 *
 * The three sites read the category from different descriptor shapes
 * (`ArgType`, runtime `Type`, `EmitArg`) but classify into the same three
 * shapes, so each site supplies a small adapter and shares this classifier.
 */
export type ArgCategory =
    | { kind: "plainInput" }
    | { kind: "outCell"; inout: boolean }
    | { kind: "callerAllocated"; inout: boolean };

/**
 * The direction and caller-allocation facts a call site extracts from its own
 * descriptor before classifying.
 *
 * `direction` is `undefined` for a plain input argument, `"out"` for a
 * pure output, or `"inout"` for an argument read on the way in and written on
 * the way out. `callerAllocated` is `true` when the caller owns the storage and
 * the value is filled in place rather than returned through a cell.
 */
export type ArgDirectionMeta = {
    direction?: "out" | "inout" | undefined;
    callerAllocated: boolean;
};

/**
 * Classify a single argument into a plain input, an out/inout cell, or a
 * caller-allocated buffer.
 *
 * @param meta - the direction and caller-allocation facts read from a site's descriptor.
 * @returns the discriminated argument category.
 */
export const classifyArgCategory = (meta: ArgDirectionMeta): ArgCategory => {
    if (meta.direction === undefined) return { kind: "plainInput" };
    const inout = meta.direction === "inout";
    return meta.callerAllocated ? { kind: "callerAllocated", inout } : { kind: "outCell", inout };
};
