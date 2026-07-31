import type { GirField } from "../../gir/field.js";
import type { TypeId } from "../../gir/type-id.js";
import type { EntityType, GirType } from "../../gir/type.js";
import type { ModuleContext } from "../../writer/context.js";
import {
    computeFieldSlots,
    type FieldLayout,
    type FieldLayoutInput,
    type FieldSlot,
    layoutOfPrimitive,
} from "../../gir/size.js";

type ResolvedRecordValue = Extract<EntityType, { kind: "record" }>["value"];

type RecordFieldSlot = {
    field: GirField;
    slot: FieldSlot;
};

const POINTER_LAYOUT: FieldLayout = { size: 8, align: 8 };
const recordLayoutCache: Map<string, FieldLayout> = new Map();

const ALIGNMENT_OVERRIDES: Map<string, FieldLayout> = new Map([
    ["graphene_simd4f_t", { size: 16, align: 16 }],
    ["graphene_simd4x4f_t", { size: 64, align: 16 }],
]);

const computeRecordFieldSlots = (
    context: ModuleContext,
    fields: GirField[],
    isUnion = false,
): { slots: RecordFieldSlot[]; size: number } => {
    const inputs: FieldLayoutInput[] = Array.from(fields, (field) => fieldLayoutInput(context, field, new Set()));
    const result = computeFieldSlots(inputs, isUnion);

    const slots = result.slots.map((slot, index) => {
        const field = fields[index];

        if (field === undefined) {
            throw new Error("computeRecordFieldSlots: parallel arrays diverged");
        }

        return { field, slot };
    });

    return { slots, size: result.size };
};

const bitMask = (width: number): number => {
    if (width >= 32) {
        return 0xFF_FF_FF_FF;
    }

    return (1 << width) - 1;
};

const mergeBitfield = (readExpr: string, valueExpr: string, mask: number, shift: number): string => {
    const maskExpr = String(mask);
    const shiftExpr = String(shift);

    return (
        `((${readExpr} & ~(${maskExpr} << ${shiftExpr})) | ` +
        `((Number(${valueExpr}) & ${maskExpr}) << ${shiftExpr})) >>> 0`
    );
};

const fieldLayoutInput = (context: ModuleContext, field: GirField, visited: Set<string>): FieldLayoutInput => {
    if (field.inlineMembers !== undefined) {
        const layout = inlineMemberLayout(context, field.inlineMembers, field.inlineIsUnion, visited);

        return { layout, bits: undefined };
    }

    if (field.type === undefined) {
        return { layout: POINTER_LAYOUT, bits: undefined };
    }

    return { layout: layoutOfType(context, field.type, field.cType, visited), bits: field.bits };
};

const inlineMemberLayout = (
    context: ModuleContext,
    members: GirField[],
    isUnion: boolean,
    visited: Set<string>,
): FieldLayout => {
    const inputs = Array.from(members, (member) => fieldLayoutInput(context, member, visited));

    if (inputs.length === 0) {
        return { size: 0, align: 1 };
    }

    const { size } = computeFieldSlots(inputs, isUnion);

    return { size, align: Math.max(1, ...inputs.map((input) => input.layout.align)) };
};

const pointerOr = (occurrenceCType: string | undefined, otherwise: () => FieldLayout): FieldLayout =>
    occurrenceCType?.endsWith("*") === true ? POINTER_LAYOUT : otherwise();

const layoutOfType = (
    context: ModuleContext,
    ref: TypeId,
    occurrenceCType: string | undefined,
    visited: Set<string>,
): FieldLayout => {
    const type = context.library.typeFor(ref);

    if (type === undefined) {
        return POINTER_LAYOUT;
    }

    switch (type.kind) {
        case "primitive": {
            return pointerOr(occurrenceCType, () => layoutOfPrimitive(type.category));
        }
        case "carray": {
            return arrayLayout(context, type, visited);
        }
        case "list":
        case "hashtable":
        case "callback":
        case "varargs":
        case "class":
        case "interface": {
            return POINTER_LAYOUT;
        }
        case "enum": {
            return pointerOr(occurrenceCType, () => layoutOfPrimitive("int32"));
        }
        case "record": {
            return pointerOr(occurrenceCType, () => layoutOfRecord(context, type, visited));
        }
        case "alias": {
            return pointerOr(occurrenceCType, () => resolveAliasLayout(context, type, visited));
        }
    }
};

const arrayLayout = (
    context: ModuleContext,
    ref: Extract<GirType, { kind: "carray" }>,
    visited: Set<string>,
): FieldLayout => {
    if (ref.fixedSize === undefined) {
        return POINTER_LAYOUT;
    }

    const elementLayout = layoutOfType(context, ref.element, ref.elementCType, visited);

    return { size: elementLayout.size * ref.fixedSize, align: elementLayout.align };
};

const declaredLayout = (record: ResolvedRecordValue): FieldLayout | undefined => {
    if (record.cType?.endsWith("*") === true) {
        return POINTER_LAYOUT;
    }

    return record.cType === undefined ? undefined : ALIGNMENT_OVERRIDES.get(record.cType);
};

const layoutOfRecord = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "record" }>,
    visited: Set<string>,
): FieldLayout => {
    const declared = declaredLayout(resolved.value);

    if (declared !== undefined) {
        return declared;
    }

    const key = `${resolved.namespace.name}.${resolved.value.name}`;

    if (visited.has(key)) {
        return POINTER_LAYOUT;
    }

    const cached = recordLayoutCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(key);

    const inputs: FieldLayoutInput[] = Array.from(resolved.value.fields, (field) =>
        fieldLayoutInput(context, field, nextVisited));

    if (inputs.length === 0) {
        return POINTER_LAYOUT;
    }

    const { size } = computeFieldSlots(inputs, resolved.value.isUnion);
    const align = Math.max(1, ...inputs.map((input) => input.layout.align));
    const layout: FieldLayout = { size, align };
    recordLayoutCache.set(key, layout);

    return layout;
};

const resolveAliasLayout = (
    context: ModuleContext,
    resolved: Extract<EntityType, { kind: "alias" }>,
    visited: Set<string>,
): FieldLayout => {
    const ref = resolved.value.target;

    if (ref === undefined) {
        return POINTER_LAYOUT;
    }

    return layoutOfType(context, ref, resolved.value.targetCType, visited);
};

export { computeRecordFieldSlots, bitMask, mergeBitfield, type RecordFieldSlot };
