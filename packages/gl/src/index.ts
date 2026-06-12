/**
 * OpenGL 4.6 core bindings for GTKX `GLArea` rendering.
 *
 * The `generated/` modules are emitted from the Khronos registry by
 * `@gtkx/codegen` (`pnpm --filter @gtkx/codegen codegen:gl`); the companion
 * module hand-writes the cold paths the registry cannot express. Export name
 * sets are disjoint by generator-time assertion.
 */
export * from "./companion.js";
export * from "./generated/commands.js";
export * from "./generated/enums.js";
export type * from "./generated/types.js";
