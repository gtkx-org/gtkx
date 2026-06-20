import type { ModuleContext } from "../dsl/context.js";
import type { GirField } from "../gir/field.js";
import {
    computeFieldSlots,
    type FieldLayout,
    type FieldLayoutInput,
    type FieldSlot,
    layoutOfPrimitive,
} from "../gir/size.js";
import type { EntityType, GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";

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
 * @param context - The module context
 * @param fields - The boxed's field list in declaration order
 */
export const computeBoxedFieldSlots = (
    context: ModuleContext,
    fields: readonly GirField[],
    isUnion = false,
): { readonly slots: readonly BoxedFieldSlot[]; readonly size: number } => {
    const inputs: FieldLayoutInput[] = [];
    for (const field of fields) {
        inputs.push(fieldLayoutInput(context, field, new Set()));
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

const fieldLayoutInput = (context: ModuleContext, field: GirField, visited: ReadonlySet<string>): FieldLayoutInput => {
    if (field.type === undefined) {
        return { layout: POINTER_LAYOUT, bits: undefined };
    }
    return { layout: layoutOfType(context, field.type, field.cType, visited), bits: field.bits };
};

const layoutOfType = (
    context: ModuleContext,
    ref: TypeId,
    occurrenceCType: string | undefined,
    visited: ReadonlySet<string>,
): FieldLayout => {
    const type = context.repository.typeOf(ref);
    if (type === undefined) return POINTER_LAYOUT;
    switch (type.kind) {
        case "primitive":
            return layoutOfPrimitive(type.category);
        case "carray":
            return arrayLayout(context, type, visited);
        case "list":
        case "hashtable":
        case "callback":
        case "varargs":
        case "class":
        case "interface":
            return POINTER_LAYOUT;
        case "enum":
            return occurrenceCType?.endsWith("*") === true ? POINTER_LAYOUT : layoutOfPrimitive("int32");
        case "boxed":
            return occurrenceCType?.endsWith("*") === true
                ? POINTER_LAYOUT
                : layoutOfBoxedRecord(context, type, visited);
        case "alias":
            return occurrenceCType?.endsWith("*") === true
                ? POINTER_LAYOUT
                : resolveAliasLayout(context, type, visited);
    }
};

const arrayLayout = (
    context: ModuleContext,
    ref: Extract<GirType, { kind: "carray" }>,
    visited: ReadonlySet<string>,
): FieldLayout => {
    if (ref.fixedSize === undefined) return POINTER_LAYOUT;
    const elementLayout = layoutOfType(context, ref.element, ref.elementCType, visited);
    return { size: elementLayout.size * ref.fixedSize, align: elementLayout.align };
};

const layoutOfBoxedRecord = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "boxed" }>,
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
        if (field.type === undefined) {
            inputs.push({ layout: POINTER_LAYOUT, bits: undefined });
            continue;
        }
        inputs.push({ layout: layoutOfType(context, field.type, field.cType, nextVisited), bits: field.bits });
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
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "alias" }>,
    visited: ReadonlySet<string>,
): FieldLayout => {
    const ref = resolved.target;
    if (ref === undefined) return POINTER_LAYOUT;
    return layoutOfType(context, ref, resolved.targetCType, visited);
};
