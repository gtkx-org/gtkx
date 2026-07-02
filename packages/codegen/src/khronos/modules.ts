import { sortedStrings, sortedStringsBy } from "@gtkx/utils";
import { ModuleBuilder } from "../writer/module.js";
import type { GlEnum } from "./model.js";
import { GL_SCALARS } from "./plan.js";
import type { RenderedCommand } from "./render.js";

const LIB_CONSTANT = `export const LIB = "libGL.so.1";`;

const GENERATED_HEADER = `/**
 * GENERATED FILE — do not edit.
 */`;

export const renderEnumsModule = (
    tokens: { token: GlEnum; exportName: string; literal: string; feature: string }[],
): string => {
    const builder = new ModuleBuilder();
    for (const { token, exportName, literal, feature } of tokens) {
        const groupNote = token.groups.length > 0 ? ` Groups: ${token.groups.map((g) => `\`${g}\``).join(", ")}.` : "";
        builder.appendDeclaration(
            `/** \`${token.name}\` — provided by \`${feature}\`.${groupNote} */\nexport const ${exportName} = ${literal};`,
        );
    }
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

export const renderTypesModule = (groupAliases: Map<string, string>): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/native", "ExternalObject", true);
    builder.imports.addNamed("@gtkx/native", "Handle", true);
    builder.appendDeclaration(
        `/** An opaque \`GLsync\` fence handle. */\nexport type GLsync = ExternalObject<Handle>;`,
    );
    builder.appendDeclaration(
        `/** An opaque native pointer handle (e.g. a \`glMapBufferRange\` mapping). */\nexport type GLpointer = ExternalObject<Handle>;`,
    );
    const seen = new Set<string>();
    for (const scalar of GL_SCALARS.values()) {
        if (seen.has(scalar.tsAlias)) continue;
        seen.add(scalar.tsAlias);
        builder.appendDeclaration(
            `/** The C \`${scalar.tsAlias}\` scalar. */\nexport type ${scalar.tsAlias} = number;`,
        );
    }
    for (const [group, base] of sortedStringsBy(groupAliases.entries(), ([key]) => key)) {
        builder.appendDeclaration(
            `/** Registry enum group \`${group}\`; open and documentation-only, any \`${base}\` value is accepted. */\nexport type ${group} = ${base};`,
        );
    }
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const TS_PRIMITIVES: Set<string> = new Set(["boolean", "string", "void", "number"]);

export const renderCommandsModule = (
    rendered: RenderedCommand[],
    singulars: RenderedCommand[],
    usedTypes: Set<string>,
): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/ffi", "t");
    for (const alias of sortedStrings(usedTypes)) {
        if (TS_PRIMITIVES.has(alias)) continue;
        builder.imports.addNamed("./types.js", alias, true);
    }
    builder.appendBinding(LIB_CONSTANT);
    for (const command of rendered) {
        if (command.binding !== undefined) builder.appendBinding(command.binding, command.binding);
    }
    for (const singular of singulars) {
        if (singular.binding !== undefined) builder.appendBinding(singular.binding, singular.binding);
    }
    for (const command of rendered) builder.appendDeclaration(command.declaration);
    for (const singular of singulars) builder.appendDeclaration(singular.declaration);
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};
