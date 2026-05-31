import type { ModuleContext } from "../dsl/context.js";
import { pascalCase } from "@gtkx/utils";
import type { GirAlias } from "../gir/namespace.js";
import { writeTsType } from "./types-ts.js";

/**
 * Emits an `export type` declaration for a GIR `<alias>`.
 *
 * Prefers the GIR `c:type` attribute over the `name` attribute when the
 * two differ, since runtime consumers reach for the C-side name
 * (`GType` rather than `Type`). The GIR `name` is only used for
 * cross-namespace resolution inside the codegen and never appears in the
 * runtime export surface; emitting both would clash with runtime modules
 * that already export the same short identifier as a value (e.g. the
 * `Type` enum in `@gtkx/ffi/gobject`).
 *
 * @param ctx - The module context
 * @param alias - The alias to emit
 */
export const emitAlias = (ctx: ModuleContext, alias: GirAlias): void => {
    const exportName = alias.cType ?? pascalCase(alias.name);
    const targetType = writeTsType(ctx, alias.target);
    ctx.module.appendDeclaration(`export type ${exportName} = ${targetType};`);
};
