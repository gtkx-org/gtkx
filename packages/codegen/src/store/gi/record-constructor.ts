import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirField } from "../../gir/field.js";
import type { GirFunction } from "../../gir/function.js";
import type { GirRecord } from "../../gir/record.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { inputParameters, parameterIdentifier } from "../../analysis/param-structure.js";
import { renderParameterTsType } from "../../analysis/ts-type.js";
import { renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import { type Callables, staticMembers } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import {
    emitFieldWrite,
    hasOwnedFieldStorage,
    isEmittableField,
    isInlineField,
    isPublicField,
    isStorableFieldType,
    isVisibleField,
} from "./record-field-accessor.js";
import { computeRecordFieldSlots, type RecordFieldSlot } from "./record-layout.js";
import { defaultRecordConstructor, hasBoxedZeroInitialization, isConstructibleRecord } from "./value-marshalable.js";

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

const renderRecordConstructorProp = (context: ModuleContext, entry: RecordFieldSlot): string | undefined => {
    const { field } = entry;

    if (!field.writable || !isVisibleField(field)) {
        return undefined;
    }

    const name = toCamelIdentifier(field.name);

    if (!isPublicField(context, field)) {
        return `${name}?: never;`;
    }

    if (!isWritableFieldSlot(context, entry)) {
        return undefined;
    }

    return `${getDoc(field)}${name}?: ${renderParameterTsType(context, field.type, { isValueWidened: false })};`;
};

const renderRecordConstructorPropsInterface = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
): string => {
    const head = `export interface ${className}ConstructorProps`;
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const lines = slots
        .map((entry) => renderRecordConstructorProp(context, entry))
        .filter((line) => line !== undefined);

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

const defaultConstructorCall = (context: ModuleContext, spec: RecordConstructorSpec): string | undefined => {
    const constructor = defaultRecordConstructor(context, context.namespace.name, spec.record);

    return constructor?.cIdentifier === undefined
        ? undefined
        : `${toCamelIdentifier(constructor.cIdentifier)}()`;
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
    if (hasBoxedZeroInitialization(context.namespace.name, record)) {
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
