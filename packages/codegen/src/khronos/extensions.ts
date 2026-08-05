import { sortStrings } from "@gtkx/utils";
import type { GlExtension, GlInterfaceBlock, GlRegistry } from "./model.js";
import type { GlSelection } from "./select.js";

type GlExtensionAttribution = {
    name: string;
    notes: string[];
};

type GlExtensionIndex = {
    commands: Map<string, GlExtensionAttribution[]>;
    enums: Map<string, GlExtensionAttribution[]>;
};

type PendingIndex = Map<string, Map<string, string[]>>;

type PendingExtensionIndex = {
    commands: PendingIndex;
    enums: PendingIndex;
};

const SUPPORTED_APIS: Set<string> = new Set(["gl", "glcore"]);

const isExtensionSupported = (extension: GlExtension): boolean =>
    extension.supported.some((api) => SUPPORTED_APIS.has(api));

const isBlockIncluded = (block: GlInterfaceBlock, selection: GlSelection): boolean =>
    block.kind === "require" &&
    (block.api === undefined || block.api === selection.api) &&
    (block.profile === undefined || block.profile === selection.profile);

const blockNotes = (extension: GlExtension, block: GlInterfaceBlock): string[] => [
    ...(extension.comment === undefined ? [] : [extension.comment]),
    ...(block.comment === undefined ? [] : [block.comment]),
];

const appendMembers = (index: PendingIndex, names: string[], extension: string, notes: string[]): void => {
    for (const name of names) {
        const byExtension = index.get(name) ?? new Map<string, string[]>();
        byExtension.set(extension, [...(byExtension.get(extension) ?? []), ...notes]);
        index.set(name, byExtension);
    }
};

const indexExtension = (index: PendingExtensionIndex, extension: GlExtension, selection: GlSelection): void => {
    for (const block of extension.blocks) {
        if (!isBlockIncluded(block, selection)) {
            continue;
        }

        const notes = blockNotes(extension, block);
        appendMembers(index.commands, block.commands, extension.name, notes);
        appendMembers(index.enums, block.enums, extension.name, notes);
    }
};

const attributionsFor = (byExtension: Map<string, string[]>): GlExtensionAttribution[] =>
    sortStrings(byExtension.keys()).map((name) => ({
        name,
        notes: [...new Set(byExtension.get(name))],
    }));

const finalizeIndex = (pending: PendingIndex): Map<string, GlExtensionAttribution[]> => {
    const index: Map<string, GlExtensionAttribution[]> = new Map();

    for (const [name, byExtension] of pending) {
        index.set(name, attributionsFor(byExtension));
    }

    return index;
};

const buildExtensionIndex = (registry: GlRegistry, selection: GlSelection): GlExtensionIndex => {
    const pending: PendingExtensionIndex = { commands: new Map(), enums: new Map() };

    for (const extension of registry.extensions) {
        if (isExtensionSupported(extension)) {
            indexExtension(pending, extension, selection);
        }
    }

    return { commands: finalizeIndex(pending.commands), enums: finalizeIndex(pending.enums) };
};

export { buildExtensionIndex, type GlExtensionAttribution, type GlExtensionIndex };
