import type { GirField } from "../gir/field.js";
import type { GirRecord } from "../gir/record.js";
import type { TypeId } from "../gir/type-id.js";
import type { ModuleContext } from "../writer/context.js";
import { PRIMITIVE_SIZE } from "../gir/primitives.js";
import { computeRecordFieldSlots, recordInlineSize } from "../store/gi/record-layout.js";
import { cTypePointerDepth, underlyingType } from "./type-shape.js";

type Atom = { kind: string; size: number; offset: number };
type Layout = { atoms: Atom[]; size: number };

const integerKind = (size: number): string => (size === 8 ? "biguint64" : `uint${String(size * 8)}`);

const fieldsLayout = (
    context: ModuleContext,
    fields: GirField[],
    union: boolean,
    seen: Set<string>,
): Layout | undefined => {
    const { slots, size } = computeRecordFieldSlots(context, fields, union);
    const atoms: Atom[] = [];
    const members: Layout[] = [];
    for (const { field, slot } of slots) {
        const layout =
            field.inlineMembers === undefined
                ? typeLayout(context, field.type, field.cType, seen)
                : fieldsLayout(context, field.inlineMembers, field.isInlineUnion, seen);
        if (layout === undefined) return undefined;
        members.push(layout);
        atoms.push(...layout.atoms.map((atom) => ({ ...atom, offset: atom.offset + slot.byteOffset })));
    }
    if (union) {
        if (atoms.length === 0 || size > 8) return undefined;
        const first = members[0];
        if (first === undefined) return undefined;
        if (
            members.every(
                (member) =>
                    member.size === first.size &&
                    member.atoms.length === first.atoms.length &&
                    member.atoms.every((atom, index) => {
                        const other = first.atoms[index];
                        return other?.kind === atom.kind && other.size === atom.size && other.offset === atom.offset;
                    }),
            )
        ) {
            return first;
        }
        if (
            atoms.every((atom) => atom.kind.startsWith("float")) ||
            Math.max(...atoms.map((atom) => atom.size)) !== size
        ) {
            return undefined;
        }
        return { atoms: [{ kind: integerKind(size), size, offset: 0 }], size };
    }
    return { atoms, size };
};

function typeLayout(
    context: ModuleContext,
    ref: TypeId | undefined,
    cType: string | undefined,
    seen: Set<string>,
): Layout | undefined {
    if (cTypePointerDepth(cType) > 0) return { atoms: [{ kind: "buffer", size: 8, offset: 0 }], size: 8 };
    const type = underlyingType(context.library, ref);
    if (type?.kind === "primitive") {
        const size = PRIMITIVE_SIZE[type.category];
        if (size === 0) return undefined;
        const kind = type.category === "float32" || type.category === "float64" ? type.category : integerKind(size);
        return { atoms: [{ kind, size, offset: 0 }], size };
    }
    if (type?.kind === "enum") return { atoms: [{ kind: "int32", size: 4, offset: 0 }], size: 4 };
    if (type?.kind === "carray" && type.fixedSize !== undefined) {
        const item = typeLayout(context, type.element, type.elementCType, seen);
        if (item === undefined) return undefined;
        return {
            atoms: Array.from({ length: type.fixedSize }, (_, index) =>
                item.atoms.map((atom) => ({ ...atom, offset: atom.offset + index * item.size })),
            ).flat(),
            size: item.size * type.fixedSize,
        };
    }
    if (type?.kind !== "record") return undefined;
    const key = `${type.namespace.name}.${type.value.name}`;
    if (seen.has(key) || type.value.opaque || type.value.disguised || type.value.fields.length === 0) return undefined;
    seen.add(key);
    const layout = fieldsLayout(context, type.value.fields, type.value.isUnion, seen);
    seen.delete(key);
    return layout;
}

const recordValueAbi = (context: ModuleContext, record: GirRecord): string[] | undefined => {
    const layout = fieldsLayout(context, record.fields, record.isUnion, new Set());
    if (layout === undefined || recordInlineSize(context, record) !== layout.size) return undefined;
    const fields: string[] = [];
    let cursor = 0;
    let alignment = 1;
    for (const atom of layout.atoms.sort((a, b) => a.offset - b.offset || b.size - a.size)) {
        if (atom.offset + atom.size <= cursor) continue;
        const aligned = Math.ceil(cursor / atom.size) * atom.size;
        if (atom.offset !== aligned) return undefined;
        fields.push(`t.${atom.kind}`);
        cursor = aligned + atom.size;
        alignment = Math.max(alignment, atom.size);
    }
    return fields.length > 0 && Math.ceil(cursor / alignment) * alignment === layout.size ? fields : undefined;
};

const byValueRecordAbi = (
    context: ModuleContext,
    ref: TypeId | undefined,
    cType: string | undefined,
): string[] | undefined => {
    const type = underlyingType(context.library, ref);
    if (type?.kind !== "record" || cType === undefined || cTypePointerDepth(cType) !== 0) return undefined;
    const spelling = (name: string): string => name.replaceAll(/\bconst\b|\s+/gu, "");
    if (type.value.cType === undefined || spelling(type.value.cType) !== spelling(cType)) return undefined;
    return recordValueAbi(context, type.value);
};

export { byValueRecordAbi };
