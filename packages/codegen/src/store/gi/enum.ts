import { sanitizeTypeIdentifier, sourceStringLiteral, uniqBy } from "@gtkx/utils";
import type { EnumMember, GirEnum } from "../../gir/enum.js";
import type { ModuleContext } from "../../writer/context.js";
import { hasAnnotations } from "../../gir/annotations.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { indent } from "../../writer/emit.js";
import { getDoc } from "./doc-spec.js";

type KeyedMember = EnumMember & { key: string };

const memberDoc = (member: KeyedMember): string =>
    getDoc(member);

const enumDoc = (enumeration: GirEnum): string =>
    getDoc(enumeration);

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

    if (errorDomain !== undefined) {
        appendErrorDomain(context, enumeration, members, errorDomain);

        return;
    }

    appendEnumDeclaration(context, enumeration, members);
};

const appendErrorDomain = (
    context: ModuleContext,
    enumeration: GirEnum,
    members: KeyedMember[],
    errorDomain: string,
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

    context.declare({
        name,
        code:
            `${doc}export const ${name}: ErrorDomain<${shape}> = ` +
            `createErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} });`,
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

const enumMemberKey = (name: string): string => {
    const upper = name.toUpperCase().replaceAll("-", "_");

    return /^\d/.test(upper) ? `_${upper}` : upper;
};

const renderQuarkExpression = (context: ModuleContext, errorDomain: string): string => {
    if (context.namespace.name === "GLib") {
        return `() => quarkFromString(${sourceStringLiteral(errorDomain)})`;
    }

    const alias = context.addCrossNamespaceImport("GLib");

    return `() => ${alias}.quarkFromString(${sourceStringLiteral(errorDomain)})`;
};

export { generateEnum, enumMemberKey };
