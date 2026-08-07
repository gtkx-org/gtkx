import type { GlDocContext } from "../../src/khronos/doc-context.js";
import type { GlSymbolProvenance } from "../../src/khronos/select.js";

const docContext = (overrides: Partial<GlDocContext> = {}): GlDocContext => ({
    kinds: new Map(),
    types: new Map(),
    aliasTargets: new Map(),
    extensionCommands: new Map(),
    extensionEnums: new Map(),
    bitmaskGroups: new Set(),
    emittedCommands: new Set(),
    groupMembers: new Map(),
    ...overrides,
});

const glProvenance = (overrides: Partial<GlSymbolProvenance> = {}): GlSymbolProvenance => ({
    feature: "GL_VERSION_1_0",
    removals: [],
    ...overrides,
});

export { docContext, glProvenance };
