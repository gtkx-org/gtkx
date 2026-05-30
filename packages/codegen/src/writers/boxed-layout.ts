import type { ModuleContext } from "../dsl/context.js";
import type { GirField } from "../gir/field.js";
import { primitiveCategory } from "../gir/primitives.js";
import type { ResolvedNamed } from "../gir/repository.js";
import {
    computeFieldSlots,
    type FieldLayout,
    type FieldLayoutInput,
    type FieldSlot,
    layoutOfPrimitive,
} from "../gir/size.js";
import type { GirTypeRef, NamedTypeRef } from "../gir/type-ref.js";

const POINTER_LAYOUT: FieldLayout = { size: 8, align: 8 };

/**
 * Computed slot for a single boxed field, ready for accessor emission.
 */
export type BoxedFieldSlot = {
    readonly field: GirField;
    readonly slot: FieldSlot;
};

/**
 * Computes per-field storage slots for a boxed record.
 *
 * Walks every field (private fields included so their storage occupies
 * space) and resolves each to a primitive-size {@link FieldLayoutInput}.
 * Private fields are returned with their slots so callers can filter on
 * `field.private` while still seeing the layout-correct offsets of public
 * fields after them.
 *
 * @param ctx - The module context
 * @param fields - The boxed's field list in declaration order
 */
export const computeBoxedFieldSlots = (
    ctx: ModuleContext,
    fields: readonly GirField[],
    isUnion = false,
): { readonly slots: readonly BoxedFieldSlot[]; readonly size: number } => {
    const inputs: FieldLayoutInput[] = [];
    for (const field of fields) {
        inputs.push(fieldLayoutInput(ctx, field, new Set()));
    }
    const result = computeFieldSlots(inputs, isUnion);
    const slots = result.slots.map((slot, index) => {
        const field = fields[index];
        if (field === undefined) {
            throw new Error("computeBoxedFieldSlots: parallel arrays diverged");
        }
        return { field, slot };
    });
    return { slots, size: result.size };
};

const fieldLayoutInput = (ctx: ModuleContext, field: GirField, visited: ReadonlySet<string>): FieldLayoutInput => {
    if (field.callback !== undefined) {
        return { layout: POINTER_LAYOUT, bits: undefined };
    }
    if (field.type === undefined) {
        return { layout: POINTER_LAYOUT, bits: undefined };
    }
    return { layout: layoutOfType(ctx, field.type, visited), bits: field.bits };
};

const layoutOfType = (ctx: ModuleContext, ref: GirTypeRef, visited: ReadonlySet<string>): FieldLayout => {
    switch (ref.kind) {
        case "primitive":
            return layoutOfPrimitive(ref.category);
        case "named":
            return layoutOfNamed(ctx, ref, visited);
        case "array":
            return arrayLayout(ctx, ref, visited);
        case "list":
        case "hashtable":
        case "callback":
        case "varargs":
            return POINTER_LAYOUT;
    }
};

const arrayLayout = (
    ctx: ModuleContext,
    ref: Extract<GirTypeRef, { kind: "array" }>,
    visited: ReadonlySet<string>,
): FieldLayout => {
    if (ref.fixedSize === undefined) return POINTER_LAYOUT;
    const elementLayout = layoutOfType(ctx, ref.element, visited);
    return { size: elementLayout.size * ref.fixedSize, align: elementLayout.align };
};

const layoutOfNamed = (ctx: ModuleContext, ref: NamedTypeRef, visited: ReadonlySet<string>): FieldLayout => {
    if (ref.cType?.endsWith("*") === true) return POINTER_LAYOUT;
    const namespaceName = ref.namespaceName ?? ctx.namespace.name;
    const resolved = ctx.repository.resolveNamed(namespaceName, ref.typeName);
    if (resolved === undefined) return POINTER_LAYOUT;
    return layoutOfResolved(ctx, resolved, visited);
};

const layoutOfResolved = (ctx: ModuleContext, resolved: ResolvedNamed, visited: ReadonlySet<string>): FieldLayout => {
    switch (resolved.kind) {
        case "class":
        case "interface":
            return POINTER_LAYOUT;
        case "boxed":
            return layoutOfBoxedRecord(ctx, resolved, visited);
        case "enum":
            return layoutOfPrimitive("int32");
        case "callback":
            return POINTER_LAYOUT;
        case "alias":
            return resolveAliasLayout(ctx, resolved, visited);
    }
};

const layoutOfBoxedRecord = (
    ctx: ModuleContext,
    resolved: Extract<ResolvedNamed, { kind: "boxed" }>,
    visited: ReadonlySet<string>,
): FieldLayout => {
    if (resolved.value.cType?.endsWith("*") === true) return POINTER_LAYOUT;
    const key = `${resolved.namespace.name}.${resolved.value.name}`;
    if (visited.has(key)) return POINTER_LAYOUT;
    const cached = recordLayoutCache.get(key);
    if (cached !== undefined) return cached;
    const nextVisited = new Set(visited);
    nextVisited.add(key);
    const inputs: FieldLayoutInput[] = [];
    for (const field of resolved.value.fields) {
        if (field.callback !== undefined) {
            inputs.push({ layout: POINTER_LAYOUT, bits: undefined });
            continue;
        }
        if (field.type === undefined) {
            inputs.push({ layout: POINTER_LAYOUT, bits: undefined });
            continue;
        }
        inputs.push({ layout: layoutOfType(ctx, field.type, nextVisited), bits: field.bits });
    }
    if (inputs.length === 0) return POINTER_LAYOUT;
    const { size } = computeFieldSlots(inputs, resolved.value.isUnion);
    const align = Math.max(1, ...inputs.map((input) => input.layout.align));
    const layout: FieldLayout = { size, align };
    recordLayoutCache.set(key, layout);
    return layout;
};

const recordLayoutCache = new Map<string, FieldLayout>();

const resolveAliasLayout = (
    ctx: ModuleContext,
    resolved: Extract<ResolvedNamed, { kind: "alias" }>,
    visited: ReadonlySet<string>,
): FieldLayout => {
    const ref = resolved.targetRef;
    if (ref === undefined) return POINTER_LAYOUT;
    if (ref.kind === "named") {
        const primitive = primitiveCategory(ref.typeName);
        if (primitive !== undefined) return layoutOfPrimitive(primitive);
    }
    return layoutOfType(ctx, ref, visited);
};
