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
