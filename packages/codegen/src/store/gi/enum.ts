import { sourceStringLiteral } from "@gtkx/utils";
import type { GirEnum } from "../../gir/enum.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indent } from "../../writer/emit.js";

export const generateEnum = (context: ModuleContext, enumeration: GirEnum): void => {
    if (!enumeration.introspectable) return;
    const name = enumeration.name;
    const memberKeys = enumeration.members.map((member) => enumMemberKey(member.name));
    if (enumeration.errorDomain !== undefined) {
        const memberEntries = enumeration.members.map((member, index) => `${memberKeys[index]}: ${member.value}`);
        const typeFields = memberKeys.map((key) => `${key}: number`).join("; ");
        context.addRuntimeImport("createErrorDomain");
        context.addRuntimeImport("ErrorDomain");
        const quarkExpression = renderQuarkExpression(context, enumeration.errorDomain);
        context.module.appendDeclaration(`${renderJsDoc(enumeration.doc)}export type ${name} = number;`);
        context.module.appendDeclaration(
            `export const ${name}: ErrorDomain<{ ${typeFields} }> = createErrorDomain(${quarkExpression}, { ${memberEntries.join(", ")} });`,
        );
        return;
    }
    if (enumeration.members.some((member) => member.doc !== undefined)) {
        const memberBlocks = enumeration.members.map(
            (member, index) => `${renderJsDoc(member.doc)}${memberKeys[index]} = ${member.value},`,
        );
        context.module.appendDeclaration(
            `${renderJsDoc(enumeration.doc)}export enum ${name} {\n${indent(memberBlocks.join("\n"), 1)}\n}`,
        );
        return;
    }
    const memberDeclarations = enumeration.members.map((member, index) => `${memberKeys[index]} = ${member.value}`);
    context.module.appendDeclaration(
        `${renderJsDoc(enumeration.doc)}export enum ${name} { ${memberDeclarations.join(", ")} }`,
    );
};

export const enumMemberKey = (name: string): string => {
    const upper = name.toUpperCase().replaceAll("-", "_");
    return /^[0-9]/.test(upper) ? `_${upper}` : upper;
};

const renderQuarkExpression = (context: ModuleContext, errorDomain: string): string => {
    if (context.namespace.name === "GLib") {
        return `() => quarkFromString(${sourceStringLiteral(errorDomain)})`;
    }
    const alias = context.addCrossNamespaceImport("GLib");
    return `() => ${alias}.quarkFromString(${sourceStringLiteral(errorDomain)})`;
};
