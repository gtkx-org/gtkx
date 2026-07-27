import type { GlEnum, GlFeature, GlInterfaceBlock, GlRegistry } from "./model.js";

type GlProfile = "core";

type GlSelection = {
    api: string;
    version: number;
    profile: GlProfile;
};

type GlSubset = {
    commands: Map<string, string>;
    enums: Map<string, string>;
};

const isBlockApplicable = (block: GlInterfaceBlock, selection: GlSelection): boolean =>
    block.profile === undefined || block.profile === selection.profile;

const addMissing = (target: Map<string, string>, names: string[], value: string): void => {
    for (const name of names) {
        if (!target.has(name)) {
            target.set(name, value);
        }
    }
};

const applyRequires = (
    feature: GlFeature,
    selection: GlSelection,
    commands: Map<string, string>,
    enums: Map<string, string>,
): void => {
    for (const block of feature.requires) {
        if (!isBlockApplicable(block, selection)) {
            continue;
        }

        addMissing(commands, block.commands, feature.name);
        addMissing(enums, block.enums, feature.name);
    }
};

const removeBlock = (block: GlInterfaceBlock, commands: Map<string, string>, enums: Map<string, string>): void => {
    for (const name of block.commands) {
        commands.delete(name);
    }

    for (const name of block.enums) {
        enums.delete(name);
    }
};

const applyRemoves = (
    feature: GlFeature,
    selection: GlSelection,
    commands: Map<string, string>,
    enums: Map<string, string>,
): void => {
    for (const block of feature.removes) {
        if (!isBlockApplicable(block, selection)) {
            continue;
        }

        removeBlock(block, commands, enums);
    }
};

const selectSubset = (registry: GlRegistry, selection: GlSelection): GlSubset => {
    const features = registry.features
        .filter((feature) => feature.api === selection.api && feature.number <= selection.version)
        .toSorted((a, b) => a.number - b.number);

    const commands: Map<string, string> = new Map();
    const enums: Map<string, string> = new Map();

    for (const feature of features) {
        applyRequires(feature, selection, commands, enums);
    }

    for (const feature of features) {
        applyRemoves(feature, selection, commands, enums);
    }

    return { commands, enums };
};

const resolveEnum = (registry: GlRegistry, name: string): GlEnum => {
    const found = registry.enums.find((candidate) => candidate.name === name);

    if (found === undefined) {
        throw new Error(`Enum token ${name} has no definition in the registry`);
    }

    return found;
};

export { selectSubset, resolveEnum, type GlSelection };
