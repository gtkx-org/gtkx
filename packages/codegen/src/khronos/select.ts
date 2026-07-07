import type { GlEnum, GlFeature, GlInterfaceBlock, GlRegistry } from "./model.js";

type GlProfile = "core";

export type GlSelection = {
    api: string;
    version: number;
    profile: GlProfile;
};

type GlSubset = {
    commands: Map<string, string>;
    enums: Map<string, string>;
};

const blockApplies = (block: GlInterfaceBlock, selection: GlSelection): boolean =>
    block.profile === undefined || block.profile === selection.profile;

const applyRequires = (
    feature: GlFeature,
    selection: GlSelection,
    commands: Map<string, string>,
    enums: Map<string, string>,
): void => {
    for (const block of feature.requires) {
        if (!blockApplies(block, selection)) continue;
        for (const name of block.commands) {
            if (!commands.has(name)) commands.set(name, feature.name);
        }
        for (const name of block.enums) {
            if (!enums.has(name)) enums.set(name, feature.name);
        }
    }
};

const applyRemoves = (
    feature: GlFeature,
    selection: GlSelection,
    commands: Map<string, string>,
    enums: Map<string, string>,
): void => {
    for (const block of feature.removes) {
        if (!blockApplies(block, selection)) continue;
        for (const name of block.commands) commands.delete(name);
        for (const name of block.enums) enums.delete(name);
    }
};

export const selectSubset = (registry: GlRegistry, selection: GlSelection): GlSubset => {
    const features = registry.features
        .filter((feature) => feature.api === selection.api && feature.number <= selection.version)
        .sort((a, b) => a.number - b.number);

    const commands = new Map<string, string>();
    const enums = new Map<string, string>();
    for (const feature of features) applyRequires(feature, selection, commands, enums);
    for (const feature of features) applyRemoves(feature, selection, commands, enums);
    return { commands, enums };
};

export const resolveEnum = (registry: GlRegistry, name: string): GlEnum => {
    const found = registry.enums.find((candidate) => candidate.name === name);
    if (found === undefined) {
        throw new Error(`Enum token ${name} has no definition in the registry`);
    }
    return found;
};
