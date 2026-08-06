import { sortStrings, sortStringsBy } from "@gtkx/utils";
import type { GlDocContext } from "./doc-context.js";
import type { GlEnum, GlType } from "./model.js";
import type { RenderedCommand } from "./render.js";
import type { GlSymbolProvenance } from "./select.js";
import { ModuleBuilder } from "../writer/module.js";
import { asSentence, backtick, backtickList, provenanceLines } from "./notes.js";
import { GL_SCALARS } from "./plan.js";

type EnumRow = {
    token: GlEnum;
    exportName: string;
    literal: string;
    provenance: GlSymbolProvenance;
};

const LIB_CONSTANT =
    "/** The shared library the generated OpenGL bindings are loaded from. */\n" +
    "export const LIB = \"libGL.so.1\";";

const SYNC_SUMMARY = "An opaque `GLsync` fence handle";
const TS_PRIMITIVES: Set<string> = new Set(["boolean", "string", "void", "number"]);

const attributionLine = (line: string): string => (line.length === 0 ? " *" : ` * ${line}`);

const attributionLines = (registryComment: string | undefined): string[] =>
    registryComment === undefined
        ? []
        : [" *", ...registryComment.split("\n").map((line) => attributionLine(line))];

const generatedHeader = (docs: GlDocContext): string =>
    [
        "/**",
        " * GENERATED FILE: do not edit.",
        " *",
        " * Derived from the Khronos OpenGL registry (gl.xml).",
        ...attributionLines(docs.registryComment),
        " */",
    ].join("\n");

const groupsLine = (groups: string[]): string[] => (groups.length === 0 ? [] : [` * Groups: ${backtickList(groups)}.`]);

const rangePhrase = (vendor: string | undefined): string =>
    vendor === undefined ? "Registry enumerant block" : `Allocated from the ${backtick(vendor)} enumerant range`;

const rangeLine = ({ vendor, blockComment }: GlEnum): string[] => {
    if (vendor === undefined && blockComment === undefined) {
        return [];
    }

    const phrase = rangePhrase(vendor);
    const text = blockComment === undefined ? phrase : `${phrase}: ${blockComment}`;

    return [` * ${asSentence(text)}`];
};

const tokenNoteLines = (token: GlEnum): string[] => [
    ...groupsLine(token.groups),
    ...(token.comment === undefined ? [] : [` * Token note: ${asSentence(token.comment)}`]),
    ...(token.alias === undefined ? [] : [` * Also known as ${backtick(token.alias)}.`]),
    ...(token.valueType === undefined ? [] : [` * Tagged ${backtick(token.valueType)} in the registry.`]),
    ...rangeLine(token),
];

const enumJsDoc = ({ token, provenance }: EnumRow, docs: GlDocContext): string =>
    [
        "/**",
        ` * ${backtick(token.name)}.`,
        " *",
        ...provenanceLines(provenance, docs.extensionEnums.get(token.name) ?? []),
        ...tokenNoteLines(token),
        " */",
    ].join("\n");

const renderEnumsModule = (tokens: EnumRow[], docs: GlDocContext): string => {
    const builder = new ModuleBuilder();

    for (const row of tokens) {
        builder.appendDeclaration(`${enumJsDoc(row, docs)}\nexport const ${row.exportName} = ${row.literal};`);
    }

    return `${generatedHeader(docs)}\n\n${builder.toSource()}`;
};

const scalarSentences = (alias: string, type: GlType): string[] => [
    `The C ${backtick(alias)} scalar: ${backtick(type.declaration)}.`,
    ...(type.requires === undefined ? [] : [`Requires the ${backtick(type.requires)} header.`]),
    ...(type.comment === undefined ? [] : [`Registry note: ${asSentence(type.comment)}`]),
];

const scalarJsDoc = (alias: string, docs: GlDocContext): string => {
    const type = docs.types.get(alias);

    if (type === undefined) {
        return `/** The C ${backtick(alias)} scalar. */`;
    }

    return `/** ${scalarSentences(alias, type).join(" ")} */`;
};

const syncJsDoc = (docs: GlDocContext): string => {
    const type = docs.types.get("GLsync");

    if (type === undefined) {
        return `/** ${SYNC_SUMMARY}. */`;
    }

    return `/** ${SYNC_SUMMARY}: ${backtick(type.declaration)}. */`;
};

const groupSummary = (group: string, isBitmask: boolean): string =>
    isBitmask
        ? `Registry enum group ${backtick(group)}, declared as a bitmask: members are combined with \`|\`.`
        : `Registry enum group ${backtick(group)}.`;

const memberLines = (members: string[]): string[] =>
    members.length === 0 ? [] : [" *", ` * Members: ${backtickList(members)}.`];

const groupAliasJsDoc = (group: string, base: string, docs: GlDocContext): string =>
    [
        "/**",
        ` * ${groupSummary(group, docs.bitmaskGroups.has(group))}`,
        " *",
        ` * Open and documentation-only; any ${backtick(base)} value is accepted.`,
        ...memberLines(docs.groupMembers.get(group) ?? []),
        " */",
    ].join("\n");

const appendScalarAliases = (builder: ModuleBuilder, docs: GlDocContext): void => {
    const seen: Set<string> = new Set();

    for (const scalar of GL_SCALARS.values()) {
        if (seen.has(scalar.tsAlias)) {
            continue;
        }

        seen.add(scalar.tsAlias);
        builder.appendDeclaration(`${scalarJsDoc(scalar.tsAlias, docs)}\nexport type ${scalar.tsAlias} = number;`);
    }
};

const appendGroupAliases = (builder: ModuleBuilder, groupAliases: Map<string, string>, docs: GlDocContext): void => {
    const sorted = sortStringsBy(groupAliases.entries(), ([key]) => key);

    for (const [group, base] of sorted) {
        builder.appendDeclaration(`${groupAliasJsDoc(group, base, docs)}\nexport type ${group} = ${base};`);
    }
};

const renderTypesModule = (groupAliases: Map<string, string>, docs: GlDocContext): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/native", "ExternalObject", true);
    builder.imports.addNamed("@gtkx/native", "Handle", true);
    builder.appendDeclaration(`${syncJsDoc(docs)}\nexport type GLsync = ExternalObject<Handle>;`);

    builder.appendDeclaration(
        "/** An opaque native pointer handle (e.g. a `glMapBufferRange` mapping). */\n" +
        "export type GLpointer = ExternalObject<Handle>;",
    );

    appendScalarAliases(builder, docs);
    appendGroupAliases(builder, groupAliases, docs);

    return `${generatedHeader(docs)}\n\n${builder.toSource()}`;
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
    docs: GlDocContext,
): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/runtime", "t");
    appendTypeImports(builder, usedTypes);
    builder.appendBinding(LIB_CONSTANT);
    appendCommandBindings(builder, rendered);
    appendCommandBindings(builder, singulars);
    appendCommandDeclarations(builder, rendered);
    appendCommandDeclarations(builder, singulars);

    return `${generatedHeader(docs)}\n\n${builder.toSource()}`;
};

export { renderEnumsModule, renderTypesModule, renderCommandsModule, type EnumRow };
