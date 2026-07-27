import { sortStrings, sortStringsBy } from "@gtkx/utils";
import type { GlEnum } from "./model.js";
import type { RenderedCommand } from "./render.js";
import { ModuleBuilder } from "../writer/module.js";
import { GL_SCALARS } from "./plan.js";

const LIB_CONSTANT = "export const LIB = \"libGL.so.1\";";

const GENERATED_HEADER = `/**
 * GENERATED FILE: do not edit.
 */`;

const TS_PRIMITIVES: Set<string> = new Set(["boolean", "string", "void", "number"]);

const quotedGroupList = (groups: string[]): string => groups.map((group) => `\`${group}\``).join(", ");

const renderEnumsModule = (
    tokens: { token: GlEnum; exportName: string; literal: string; feature: string }[],
): string => {
    const builder = new ModuleBuilder();

    for (const { token, exportName, literal, feature } of tokens) {
        const groupNote = token.groups.length > 0 ? ` Groups: ${quotedGroupList(token.groups)}.` : "";

        builder.appendDeclaration(
            `/** \`${token.name}\`, provided by \`${feature}\`.${groupNote} */\n` +
            `export const ${exportName} = ${literal};`,
        );
    }

    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const renderTypesModule = (groupAliases: Map<string, string>): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/native", "ExternalObject", true);
    builder.imports.addNamed("@gtkx/native", "Handle", true);

    builder.appendDeclaration(
        "/** An opaque `GLsync` fence handle. */\nexport type GLsync = ExternalObject<Handle>;",
    );

    builder.appendDeclaration(
        "/** An opaque native pointer handle (e.g. a `glMapBufferRange` mapping). */\n" +
        "export type GLpointer = ExternalObject<Handle>;",
    );

    const seen: Set<string> = new Set();

    for (const scalar of GL_SCALARS.values()) {
        if (seen.has(scalar.tsAlias)) {
            continue;
        }

        seen.add(scalar.tsAlias);

        builder.appendDeclaration(
            `/** The C \`${scalar.tsAlias}\` scalar. */\nexport type ${scalar.tsAlias} = number;`,
        );
    }

    const sortedAliases = sortStringsBy(groupAliases.entries(), ([key]) => key);

    for (const [group, base] of sortedAliases) {
        builder.appendDeclaration(
            `/** Registry enum group \`${group}\`; open and documentation-only, ` +
            `any \`${base}\` value is accepted. */\nexport type ${group} = ${base};`,
        );
    }

    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const appendTypeImports = (builder: ModuleBuilder, usedTypes: Set<string>): void => {
    for (const alias of sortStrings(usedTypes)) {
        if (TS_PRIMITIVES.has(alias)) {
            continue;
        }

        builder.imports.addNamed("./types.js", alias, true);
    }
};

const appendCommandBindings = (builder: ModuleBuilder, commands: RenderedCommand[]): void => {
    for (const command of commands) {
        if (command.binding !== undefined) {
            builder.appendBinding(command.binding, command.binding);
        }
    }
};

const appendCommandDeclarations = (builder: ModuleBuilder, commands: RenderedCommand[]): void => {
    for (const command of commands) {
        builder.appendDeclaration(command.declaration);
    }
};

const renderCommandsModule = (
    rendered: RenderedCommand[],
    singulars: RenderedCommand[],
    usedTypes: Set<string>,
): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/runtime", "t");
    appendTypeImports(builder, usedTypes);
    builder.appendBinding(LIB_CONSTANT);
    appendCommandBindings(builder, rendered);
    appendCommandBindings(builder, singulars);
    appendCommandDeclarations(builder, rendered);
    appendCommandDeclarations(builder, singulars);

    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

export { renderEnumsModule, renderTypesModule, renderCommandsModule };
