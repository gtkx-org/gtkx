import type { GirBoxed } from "./boxed.js";
import type { GirCallback } from "./callback.js";
import type { GirClass } from "./class.js";
import type { GirEnum } from "./enum.js";
import type { GirNamespace } from "./namespace.js";
import type { StructuralType, TypeId } from "./type-id.js";

/**
 * A named GIR entity interned into the arena, paired with the namespace that
 * declares it so writers can read its shared library or namespace name without
 * a second lookup.
 *
 * The `alias` variant holds its resolved target handle (and the target's
 * `c:type`, kept for the record-layout pointer test) rather than a re-parsed
 * reference.
 */
export type EntityType =
    | { readonly kind: "class"; readonly namespace: GirNamespace; readonly value: GirClass }
    | { readonly kind: "interface"; readonly namespace: GirNamespace; readonly value: GirClass }
    | { readonly kind: "boxed"; readonly namespace: GirNamespace; readonly value: GirBoxed }
    | { readonly kind: "enum"; readonly namespace: GirNamespace; readonly value: GirEnum }
    | { readonly kind: "callback"; readonly namespace: GirNamespace; readonly value: GirCallback }
    | {
          readonly kind: "alias";
          readonly namespace: GirNamespace;
          readonly target: TypeId | undefined;
          readonly targetCType: string | undefined;
      };

/**
 * One interned type: either a {@link StructuralType} (primitive, varargs, or a
 * container of {@link TypeId} children) or a named {@link EntityType}. Every
 * `<type>`/`<array>`/`<callback>` slot in the IR is a {@link TypeId} addressing
 * one of these.
 */
export type GirType = StructuralType | EntityType;
