import { sortedAlpha, sortedAlphaBy } from "@gtkx/utils";
import { ModuleBuilder } from "../dsl/module.js";
import { GL_SCALARS } from "./ctype.js";
import type { GlEnum } from "./model.js";
import type { RenderedCommand } from "./render.js";

const LIB_CONSTANT = `const LIB = "libGL.so.1";`;

const GENERATED_HEADER = `/**
 * GENERATED FILE — do not edit.
 *
 * Emitted by the \`@gtkx/codegen\` Khronos generator from the vendored
 * \`registry/gl.xml\` (gl 4.6 core profile). Regenerate with
 * \`pnpm --filter @gtkx/codegen codegen:gl\`.
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
    builder.imports.addNamed("@gtkx/native", "Handle", true);
    builder.appendDeclaration(`/** An opaque \`GLsync\` fence handle. */\nexport type GLsync = Handle;`);
    builder.appendDeclaration(
        `/** An opaque native pointer handle (e.g. a \`glMapBufferRange\` mapping). */\nexport type GLpointer = Handle;`,
    );
    const seen = new Set<string>();
    for (const scalar of GL_SCALARS.values()) {
        if (seen.has(scalar.tsAlias)) continue;
        seen.add(scalar.tsAlias);
        builder.appendDeclaration(
            `/** The C \`${scalar.tsAlias}\` scalar. */\nexport type ${scalar.tsAlias} = number;`,
        );
    }
    for (const [group, base] of sortedAlphaBy(groupAliases.entries(), ([key]) => key)) {
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
    for (const alias of sortedAlpha(usedTypes)) {
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
