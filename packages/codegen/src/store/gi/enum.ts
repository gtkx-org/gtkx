import { sourceStringLiteral } from "@gtkx/utils";
import type { GirEnum } from "../../gir/enum.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indent } from "../../writer/emit.js";

const generateEnum = (context: ModuleContext, enumeration: GirEnum): void => {
    if (!enumeration.introspectable) {
        return;
    }

    const name = enumeration.name;
    const members = enumeration.members.map((member) => ({ ...member, key: enumMemberKey(member.name) }));

    if (enumeration.errorDomain !== undefined) {
        const memberEntries = members.map((member) => `${member.key}: ${member.value}`);
        const typeFields = members.map((member) => `${member.key}: number`).join("; ");
        context.addRuntimeImport("createErrorDomain");
        context.addRuntimeImport("ErrorDomain");
        const quarkExpression = renderQuarkExpression(context, enumeration.errorDomain);
        context.module.appendDeclaration(`${renderJsDoc(enumeration.doc)}export type ${name} = number;`);

        context.module.appendDeclaration(
            `export const ${name}: ErrorDomain<{ ${typeFields} }> = ` +
            `createErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} });`,
        );

        return;
    }

    if (members.some((member) => member.doc !== undefined)) {
        const memberBlocks = members.map((member) => `${renderJsDoc(member.doc)}${member.key} = ${member.value},`);

        context.module.appendDeclaration(
            `${renderJsDoc(enumeration.doc)}export enum ${name} {\n${indent(memberBlocks.join("\n"), 1)}\n}`,
        );

        return;
    }

    const memberDeclarations = members.map((member) => `${member.key} = ${member.value}`);

    context.module.appendDeclaration(
        `${renderJsDoc(enumeration.doc)}export enum ${name} { ${memberDeclarations.join(", ")} }`,
    );
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
