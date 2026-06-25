import type { AttachShape, AttachShapeTable } from "@gtkx/config";
import { sortedStringsBy } from "@gtkx/utils";
import { ancestorChain } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { GirParameter } from "../gir/parameter.js";
import type { PrimitiveCategory } from "../gir/primitives.js";
import type { Library } from "../gir/library.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";

type ParamKind = "widget" | "int";

type ParamSpec = { kind: ParamKind; nullable?: boolean };

type ShapeSpec = {
    shape: AttachShape;
    method: string;
    params: ParamSpec[];
    returns?: ParamKind;
};

const WIDGET_GLIB_NAME = "GtkWidget";

const INTEGER_CATEGORIES: Set<PrimitiveCategory> = new Set([
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "bigint64",
    "biguint64",
]);

const widget = (nullable?: boolean): ParamSpec =>
    nullable === true ? { kind: "widget", nullable: true } : { kind: "widget" };

const integer: ParamSpec = { kind: "int" };

/**
 * The child-attachment method shapes the reconciler relies on, paired with the
 * exact GIR signature each must expose. `nullable` parameters are required to be
 * nullable because the reconciler passes `null` through them on detach.
 */
const SHAPE_SPECS: ShapeSpec[] = [
    { shape: "append", method: "append", params: [widget()] },
    { shape: "add", method: "add", params: [widget()] },
    { shape: "setContent", method: "set_content", params: [widget(true)] },
    { shape: "setChild", method: "set_child", params: [widget(true)] },
    { shape: "getChild", method: "get_child", params: [], returns: "widget" },
    { shape: "remove", method: "remove", params: [widget()] },
    { shape: "reorderChildAfter", method: "reorder_child_after", params: [widget(), widget(true)] },
    { shape: "insertChildAfter", method: "insert_child_after", params: [widget(), widget(true)] },
    { shape: "insert", method: "insert", params: [widget(), integer] },
    { shape: "getFirstChild", method: "get_first_child", params: [], returns: "widget" },
];

const resolveEntity = (library: Library, typeId: TypeId | undefined): GirType | undefined => {
    if (typeId === undefined) return undefined;
    let resolved = library.typeOf(typeId);
    while (resolved !== undefined && resolved.kind === "alias") {
        resolved = resolveEntity(library, resolved.target);
    }
    return resolved;
};

const isWidgetType = (library: Library, typeId: TypeId | undefined): boolean => {
    const entity = resolveEntity(library, typeId);
    if (entity === undefined || entity.kind !== "class") return false;
    for (const { klass } of ancestorChain(library, entity.value, entity.namespace.name)) {
        if (klass.glibTypeName === WIDGET_GLIB_NAME) return true;
    }
    return false;
};

const isIntType = (library: Library, typeId: TypeId | undefined): boolean => {
    const entity = resolveEntity(library, typeId);
    return entity !== undefined && entity.kind === "primitive" && INTEGER_CATEGORIES.has(entity.category);
};

const paramMatches = (library: Library, param: GirParameter, spec: ParamSpec): boolean => {
    if (param.isVarargs) return false;
    if (spec.nullable === true && !(param.nullable || param.optional)) return false;
    return spec.kind === "widget" ? isWidgetType(library, param.type) : isIntType(library, param.type);
};

const signatureMatches = (library: Library, method: GirFunction, spec: ShapeSpec): boolean => {
    if (method.parameters.some((param) => param.isVarargs)) return false;
    const inParams = method.parameters.filter((param) => param.direction === "in");
    if (inParams.length !== spec.params.length) return false;
    for (let index = 0; index < spec.params.length; index++) {
        const param = inParams[index];
        const paramSpec = spec.params[index];
        if (param === undefined || paramSpec === undefined || !paramMatches(library, param, paramSpec)) {
            return false;
        }
    }
    return spec.returns !== "widget" || isWidgetType(library, method.returnValue.type);
};

const ownShapes = (library: Library, klass: GirClass): AttachShape[] => {
    const shapes: AttachShape[] = [];
    for (const spec of SHAPE_SPECS) {
        const method = klass.methods.find(
            (candidate) =>
                candidate.name === spec.method && candidate.introspectable && candidate.shadowedBy === undefined,
        );
        if (method !== undefined && signatureMatches(library, method, spec)) shapes.push(spec.shape);
    }
    return shapes;
};

type ShapeEntry = { glibName: string; shapes: AttachShape[] };

/**
 * Scans every class and interface for the {@link SHAPE_SPECS}, keeping only the
 * shapes whose own method exists with the verified signature. The result is keyed
 * by GLib type name; the reconciler unions entries across an instance's type-name
 * chain and interfaces to recover its full capability set.
 */
export const collectAttachShapes = (library: Library): AttachShapeTable => {
    const entries: ShapeEntry[] = [];
    for (const namespace of library.namespaces.values()) {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) {
            const glibName = klass.glibTypeName;
            if (glibName === undefined) continue;
            const shapes = ownShapes(library, klass);
            if (shapes.length > 0) entries.push({ glibName, shapes });
        }
    }
    const table: AttachShapeTable = {};
    for (const { glibName, shapes } of sortedStringsBy(entries, (entry) => entry.glibName)) {
        table[glibName] = shapes;
    }
    return table;
};
