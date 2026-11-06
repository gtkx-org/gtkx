import { sanitizeTypeIdentifier, sourceStringLiteral, uniqBy } from "@gtkx/utils";
import { type EnumMember, enumMemberKey, type GirEnum } from "../../gir/enum.js";
import type { ModuleContext } from "../../writer/context.js";
import { hasAnnotations } from "../../gir/annotations.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { indent, pure } from "../../writer/emit.js";
import { callableDoc } from "./callable-doc.js";
import { getDoc } from "./doc-spec.js";
import { type EnumStaticFunction, enumStaticFunctions } from "./function.js";
import { renderSourceGtype } from "./gtype-binding.js";

type KeyedMember = EnumMember & { key: string };

type EnumCompanion = {
    statics: EnumStaticFunction[];
    gtype: string | undefined;
};

const memberDoc = (member: KeyedMember): string => getDoc(member);

const enumDoc = (enumeration: GirEnum): string => getDoc(enumeration);

const generateEnum = (context: ModuleContext, enumeration: GirEnum): void => {
    if (!isEmittableEntity(enumeration)) {
        return;
    }

    const members = uniqBy(
        enumeration.members
            .map((member) => ({ ...member, key: enumMemberKey(member.name) }))
            .filter((member) => member.key.length > 0),
        (member) => member.key,
    );

    const errorDomain = enumeration.errorDomain;
    const companion: EnumCompanion = {
        statics: enumStaticFunctions(context, enumeration.name),
        gtype: renderSourceGtype(context, enumeration),
    };

    if (errorDomain !== undefined) {
        appendErrorDomain(context, enumeration, members, errorDomain, companion);

        return;
    }

    if (companion.statics.length > 0 || companion.gtype !== undefined) {
        appendEnumWithCompanion(context, enumeration, members, companion);

        return;
    }

    appendEnumDeclaration(context, enumeration, members);
};

const staticsType = (context: ModuleContext, base: string, statics: EnumStaticFunction[]): string => {
    if (statics.length === 0) {
        return base;
    }

    const fields = statics.map(
        ({ name, exportName, fn }) => `${callableDoc(context, fn)}${name}: typeof ${exportName};`,
    );

    return `${base} & {\n${indent(fields.join("\n"), 1)}\n}`;
};

const staticsValue = (context: ModuleContext, target: string, statics: EnumStaticFunction[]): string => {
    if (statics.length === 0) {
        return target;
    }

    context.addRuntimeInternalImport("defineStatics");
    const entries = statics.map(({ name, exportName }) => `${name}: ${exportName}`);

    return pure(`defineStatics(${target}, { ${entries.join(", ")} })`);
};

const companionType = (context: ModuleContext, base: string, { statics, gtype }: EnumCompanion): string => {
    const type = staticsType(context, base, statics);

    return gtype === undefined ? type : `${type} & ${context.addRuntimeTypeImport("TypedEnum")}`;
};

const companionValue = (context: ModuleContext, target: string, { statics, gtype }: EnumCompanion): string => {
    const value = staticsValue(context, target, statics);

    if (gtype === undefined) {
        return value;
    }

    context.addRuntimeInternalImport("defineEnumType");

    return pure(`defineEnumType(${value}, () => ${gtype})`);
};

const appendErrorDomain = (
    context: ModuleContext,
    enumeration: GirEnum,
    members: KeyedMember[],
    errorDomain: string,
    companion: EnumCompanion,
): void => {
    const memberEntries = members.map((member) => `${member.key}: ${member.value}`);
    const typeFields = members.map((member) => `${memberDoc(member)}${member.key}: number;`);
    context.addRuntimeImport("createErrorDomain");
    context.addRuntimeImport("ErrorDomain");
    const quarkExpression = renderQuarkExpression(context, errorDomain);
    const doc = enumDoc(enumeration);
    const shape = typeFields.length === 0 ? "{}" : `{\n${indent(typeFields.join("\n"), 1)}\n}`;
    const name = sanitizeTypeIdentifier(enumeration.name);

    context.declare({
        name,
        code: `${doc}export type ${name} = number;`,
        owner: enumeration.name,
    });

    const created = pure(`createErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} })`);
    const type = companionType(context, `ErrorDomain<${shape}>`, companion);

    context.declare({
        name,
        code: `${doc}export const ${name}: ${type} = ${companionValue(context, created, companion)};`,
    });
};

const isMemberDocumented = (member: KeyedMember): boolean =>
    member.doc !== undefined || hasAnnotations(member.annotations);

const appendEnumDeclaration = (context: ModuleContext, enumeration: GirEnum, members: KeyedMember[]): void => {
    const doc = enumDoc(enumeration);
    const name = sanitizeTypeIdentifier(enumeration.name);

    if (members.some((member) => isMemberDocumented(member))) {
        const blocks = members.map((member) => `${memberDoc(member)}${member.key} = ${member.value},`);

        context.declare({
            name,
            code: `${doc}export enum ${name} {\n${indent(blocks.join("\n"), 1)}\n}`,
            owner: enumeration.name,
        });

        return;
    }

    const declarations = members.map((member) => `${member.key} = ${member.value}`);

    context.declare({
        name,
        code: `${doc}export enum ${name} { ${declarations.join(", ")} }`,
        owner: enumeration.name,
    });
};

const appendEnumWithCompanion = (
    context: ModuleContext,
    enumeration: GirEnum,
    members: KeyedMember[],
    companion: EnumCompanion,
): void => {
    const doc = enumDoc(enumeration);
    const name = sanitizeTypeIdentifier(enumeration.name);
    const localName = `_${name}`;
    const blocks = members.map((member) => `${memberDoc(member)}${member.key} = ${member.value},`);
    const memberTypes = members.map((member) => `type ${member.key} = ${localName}.${member.key};`);

    context.module.appendDeclaration({
        name: localName,
        code: `${doc}enum ${localName} {\n${indent(blocks.join("\n"), 1)}\n}`,
        isLocal: true,
    });

    context.declare({
        name,
        code: `${doc}export const ${name}: ${companionType(context, `typeof ${localName}`, companion)} = ${companionValue(context, localName, companion)};`,
    });

    context.declare({
        name,
        code:
            `${doc}export type ${name} = ${localName};\n\n` +
            `export declare namespace ${name} {\n${indent(memberTypes.join("\n"), 1)}\n}`,
        owner: enumeration.name,
    });
};

const renderQuarkExpression = (context: ModuleContext, errorDomain: string): string => {
    if (context.namespace.name === "GLib") {
        return `() => quarkFromString(${sourceStringLiteral(errorDomain)})`;
    }

    const alias = context.addCrossNamespaceImport("GLib");

    return `() => ${alias}.quarkFromString(${sourceStringLiteral(errorDomain)})`;
};

export { generateEnum };
