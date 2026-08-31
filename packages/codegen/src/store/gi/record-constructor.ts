import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirField } from "../../gir/field.js";
import type { GirFunction } from "../../gir/function.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { inputParameters, parameterIdentifier } from "../../analysis/param-structure.js";
import { renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { type Callables, staticMembers } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import { renderSourceGtype } from "./gtype-binding.js";
import {
    emitFieldWrite,
    fieldTsType,
    hasOwnedFieldStorage,
    isEmittableField,
    isInlineField,
    isStorableFieldType,
} from "./record-field-accessor.js";
import { computeRecordFieldSlots, type RecordFieldSlot } from "./record-layout.js";
import { isConstructibleRecord } from "./value-marshalable.js";

const RECORDS_REQUIRING_BOXED_FREE: Set<string> = new Set(["GObject.Value"]);

type WritableFieldSlot = RecordFieldSlot & { field: GirField & { type: TypeId } };

type RecordConstructorSpec = {
    record: GirRecord;
    className: string;
    callables: Callables;
    isErrorSubclass: boolean;
};

const isWritableFieldSlot = (context: ModuleContext, entry: RecordFieldSlot): entry is WritableFieldSlot =>
    entry.field.writable &&
    isEmittableField(context, entry.field) &&
    isStorableFieldType(context, entry.field.type);

const renderRecordConstructorPropsInterface = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
): string => {
    const head = `export interface ${className}ConstructorProps`;
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    const lines = slots
        .filter((entry): entry is WritableFieldSlot => isWritableFieldSlot(context, entry))
        .map(
            (entry) =>
                `${getDoc(entry.field)}${toCamelIdentifier(entry.field.name)}?: ` +
                `${fieldTsType(context, entry.field.type, true)};`,
        );

    return renderBracedOrEmpty(head, lines.join("\n"));
};

const isSelfReturning = (context: ModuleContext, record: GirRecord, callable: GirFunction): boolean => {
    const ref = callable.returnValue.type;
    const name = ref === undefined ? undefined : context.library.nameFor(ref);

    return name?.namespaceName === context.namespace.name && name.typeName === record.name;
};

const renderStaticCall = (context: ModuleContext, callable: GirFunction, name: string): string => {
    const args = inputParameters(context.library, callable).map(({ parameter, index }) =>
        parameterIdentifier(parameter, index));

    return `${name}(${args.join(", ")})`;
};

const constructionHint = (context: ModuleContext, spec: RecordConstructorSpec): string | undefined => {
    const candidates = staticMembers(context, spec.callables).filter(({ callable }) =>
        isSelfReturning(context, spec.record, callable));

    const candidate = candidates.find(({ name }) => name === "new") ?? candidates[0];

    return candidate === undefined ? undefined : renderStaticCall(context, candidate.callable, candidate.name);
};

const unconstructibleMessage = (context: ModuleContext, spec: RecordConstructorSpec): string => {
    const qualified = `${context.namespace.name}.${spec.className}`;
    const hint = constructionHint(context, spec);

    return hint === undefined
        ? `Cannot construct ${qualified} with new: its instances come from the functions that return them.`
        : `Cannot construct ${qualified} with new: use ${qualified}.${hint} instead.`;
};

const renderUnconstructibleGuard = (context: ModuleContext, spec: RecordConstructorSpec): string => {
    const superCall = spec.isErrorSubclass ? ["super();"] : [];
    const message = sourceStringLiteral(unconstructibleMessage(context, spec));

    return renderBlock("constructor()", [...superCall, `throw new globalThis.Error(${message});`].join("\n"));
};

const isDefaultConstructor = (context: ModuleContext, record: GirRecord, callable: GirFunction): boolean =>
    !callable.throws &&
    callable.parameters.length === 0 &&
    callable.returnValue.transferOwnership === "full" &&
    !callable.returnValue.nullable &&
    isSelfReturning(context, record, callable);

const defaultConstructorCall = (context: ModuleContext, spec: RecordConstructorSpec): string | undefined => {
    const declared: Set<GirFunction> = new Set(spec.callables.constructors);

    for (const { callable, name } of staticMembers(context, spec.callables)) {
        const { cIdentifier } = callable;

        if (name !== "new" || cIdentifier === undefined || !declared.has(callable)) {
            continue;
        }

        if (isDefaultConstructor(context, spec.record, callable)) {
            return `${toCamelIdentifier(cIdentifier)}()`;
        }
    }

    return undefined;
};

const renderEmptyConstructor = (className: string, isErrorSubclass: boolean): string =>
    isErrorSubclass
        ? renderBlock(`constructor(props: ${className}ConstructorProps = {})`, "super();")
        : `constructor(props: ${className}ConstructorProps = {}) {}`;

const renderFieldWrites = (context: ModuleContext, slots: RecordFieldSlot[]): string[] => {
    const statements: string[] = [];

    for (const entry of slots) {
        if (isWritableFieldSlot(context, entry)) {
            statements.push(renderFieldWrite(context, entry));
        }
    }

    return statements;
};

const renderConstructedRecord = (
    context: ModuleContext,
    spec: RecordConstructorSpec,
    constructorCall: string,
    slots: RecordFieldSlot[],
): string => {
    context.addRuntimeImport("getHandle");
    context.addRuntimeImport("setHandle");

    const statements = [
        ...(spec.isErrorSubclass ? ["super();"] : []),
        `const __handle = getHandle(${constructorCall});`,
        ...renderFieldWrites(context, slots),
        "setHandle(this, __handle);",
    ];

    return renderBlock(`constructor(props: ${spec.className}ConstructorProps = {})`, statements.join("\n"));
};

const renderRecordConstructor = (context: ModuleContext, spec: RecordConstructorSpec): string => {
    const { record, className, isErrorSubclass } = spec;

    if (!isConstructibleRecord(context, context.namespace.name, record)) {
        return renderUnconstructibleGuard(context, spec);
    }

    const { slots, size } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const constructorCall = defaultConstructorCall(context, spec);

    if (constructorCall !== undefined) {
        return renderConstructedRecord(context, spec, constructorCall, slots);
    }

    if (size === 0) {
        return renderEmptyConstructor(className, isErrorSubclass);
    }

    const superCall = isErrorSubclass ? ["super();"] : [];
    context.addRuntimeImport("alloc");
    context.addRuntimeImport("setHandle");

    const statements = [
        ...superCall,
        `const __handle = alloc(${allocArgs(context, record, size).join(", ")});`,
        ...renderFieldWrites(context, slots),
        "setHandle(this, __handle);",
    ];

    return renderBlock(`constructor(props: ${className}ConstructorProps = {})`, statements.join("\n"));
};

const allocArgs = (context: ModuleContext, record: GirRecord, size: number): string[] => {
    const args = [String(size)];
    const key = `${context.namespace.name}.${record.name}`;

    if (renderSourceGtype(context, record) !== undefined && RECORDS_REQUIRING_BOXED_FREE.has(key)) {
        args.push("this.__type__");
    }

    return args;
};

const renderFieldWrite = (context: ModuleContext, entry: WritableFieldSlot): string => {
    context.addRuntimeImport("t");

    const descriptor = context.hoistDescriptor(
        renderDescriptor(context, entry.field.type, "none", {
            isInline: isInlineField(context, entry.field),
            hasOwnedStorage: hasOwnedFieldStorage(entry.field),
        }),
    );

    const name = toCamelIdentifier(entry.field.name);

    const write = emitFieldWrite(context, {
        descriptor,
        slot: entry.slot,
        targetExpr: "__handle",
        valueExpr: `props.${name}`,
    });

    return `if (props.${name} !== undefined) ${write}`;
};

export { renderRecordConstructorPropsInterface, renderRecordConstructor };
