import { lowerFirst, toCamelIdentifier } from "@gtkx/utils";
import type { GlExtensionAttribution } from "./extensions.js";
import type { GlRemoval, GlSymbolProvenance } from "./select.js";

type MetadataNotesOptions = {
    type: string;
    group?: string;
    len?: string;
    objectClass?: string;
    kinds: string[];
    note?: string;
};

const commandExportName = (name: string): string =>
    toCamelIdentifier(name.startsWith("gl") ? lowerFirst(name.slice(2)) : name);

const backtick = (text: string): string => `\`${text}\``;
const backtickList = (values: string[]): string => values.map((value) => backtick(value)).join(", ");
const asSentence = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

const removalPhrase = (removal: GlRemoval): string =>
    removal.comment === undefined
        ? backtick(removal.feature)
        : `${backtick(removal.feature)} (${removal.comment})`;

const removalLine = (provenance: GlSymbolProvenance): string => {
    const phrases = provenance.removals.map((removal) => removalPhrase(removal)).join(", ");

    return ` * Removed from the core profile by ${phrases}, then restored by ${backtick(provenance.feature)}.`;
};

const extensionLine = (extensions: GlExtensionAttribution[]): string => {
    const names = backtickList(extensions.map((extension) => extension.name));

    return ` * Also provided by the ${names} extension${extensions.length === 1 ? "" : "s"}.`;
};

const extensionNoteLines = (extensions: GlExtensionAttribution[]): string[] =>
    extensions.flatMap((extension) =>
        extension.notes.map((note) => ` * ${backtick(extension.name)} note: ${asSentence(note)}`));

const extensionLines = (extensions: GlExtensionAttribution[]): string[] =>
    extensions.length === 0 ? [] : [extensionLine(extensions), ...extensionNoteLines(extensions)];

const provenanceLines = (provenance: GlSymbolProvenance, extensions: GlExtensionAttribution[]): string[] => [
    ` * Provided by ${backtick(provenance.feature)}.`,
    ...(provenance.removals.length > 0 ? [removalLine(provenance)] : []),
    ...(provenance.requireComment === undefined ? [] : [` * Registry note: ${provenance.requireComment}`]),
    ...extensionLines(extensions),
];

const metadataNotes = ({ type, group, len, objectClass, kinds, note }: MetadataNotesOptions): string =>
    [
        backtick(type),
        ...(group === undefined ? [] : [`group ${backtick(group)}`]),
        ...(len === undefined ? [] : [`length ${backtick(len)}`]),
        ...(objectClass === undefined ? [] : [`object class ${backtick(objectClass)}`]),
        ...kinds.map((kind) => `kind ${backtick(kind)}`),
        ...(note === undefined ? [] : [note]),
    ].join(", ");

const kindDescriptions = (kinds: string[], table: Map<string, string>): string =>
    kinds.flatMap((kind) => table.get(kind) ?? []).join(" ");

export {
    asSentence,
    backtick,
    backtickList,
    commandExportName,
    kindDescriptions,
    metadataNotes,
    type MetadataNotesOptions,
    provenanceLines,
};
