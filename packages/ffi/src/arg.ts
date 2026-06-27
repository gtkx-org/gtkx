import type { Descriptor, RefDescriptor } from "@gtkx/native";

/**
 * The single source of truth for the argument data-flow taxonomy crossing the
 * FFI boundary, shared by the function-call path ({@link "./fn.js"}), the
 * signal-emit path ({@link "./signal.js"}), and the callback path
 * ({@link "./callback.js"}) so the in/ref/caller-allocated rules live once.
 *
 * Two views exist because the inputs differ. The call and emit paths already
 * carry an argument's GObject-Introspection `direction`/`caller-allocates`
 * facts, so they classify with the `*Arg` predicates. The callback path only
 * has the native type descriptor, whose data-flow is encoded structurally, so
 * it classifies with the `*Descriptor`/`*Type` predicates.
 */
type DirectedArg = { direction?: "out" | "inout"; callerAllocated?: boolean };

export const isOutputArg = (arg: DirectedArg): boolean => arg.direction !== undefined;

export const isInoutArg = (arg: DirectedArg): boolean => arg.direction === "inout";

export const isCallerAllocatedArg = (arg: DirectedArg): boolean => arg.callerAllocated === true;

/** An out/inout argument passed by ref, as opposed to filling a caller-allocated buffer. */
export const isRefArg = (arg: DirectedArg): boolean => arg.direction !== undefined && arg.callerAllocated !== true;

export const isRefDescriptor = (descriptor: Descriptor): descriptor is RefDescriptor => descriptor.kind === "ref";

/** A boxed/struct descriptor whose output is written into a caller-allocated buffer. */
export const isCallerAllocatedType = (descriptor: Descriptor): boolean =>
    (descriptor.kind === "boxed" || descriptor.kind === "struct") && descriptor.callerAllocated === true;
