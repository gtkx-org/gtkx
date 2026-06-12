import type { GlEnum, GlFeature, GlInterfaceBlock, GlRegistry } from "./model.js";

/** A GL profile name as used by feature `<require>`/`<remove>` blocks. */
export type GlProfile = "core" | "compatibility";

/** The API/version/profile triple a generation run targets. */
export type GlSelection = {
    /** The registry API token (e.g. `gl`). */
    readonly api: string;
    /** The maximum feature version to include (e.g. `4.6`). */
    readonly version: number;
    /** The profile whose `<require>`/`<remove>` blocks apply. */
    readonly profile: GlProfile;
};

/** The names a selection resolves to, with their providing features. */
export type GlSubset = {
    /** Selected command names mapped to the feature that first required them. */
    readonly commands: ReadonlyMap<string, string>;
    /** Selected enum token names mapped to the feature that first required them. */
    readonly enums: ReadonlyMap<string, string>;
};

const blockApplies = (block: GlInterfaceBlock, selection: GlSelection): boolean => {
    if (block.profile !== undefined && block.profile !== selection.profile) return false;
    if (block.api !== undefined && block.api !== selection.api) return false;
    return true;
};

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

/**
 * Resolves the command and enum names a selection includes, following the
 * standard Khronos feature-resolution algorithm: every feature of the
 * selected API with a version at or below the target contributes its
 * profile-matching `<require>` blocks in ascending version order, then every
 * such feature's profile-matching `<remove>` blocks are applied.
 *
 * @param registry - The loaded registry model
 * @param selection - The API/version/profile to resolve
 */
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

/**
 * Resolves an enum token name to its definition for a selection's API.
 *
 * Token values may differ per API (`GL_ACTIVE_PROGRAM_EXT` is the canonical
 * case), so the lookup prefers a definition tagged with the selection's API
 * and falls back to the untagged definition.
 *
 * @param registry - The loaded registry model
 * @param name - The enum token name
 * @param api - The selection's API token
 */
export const resolveEnum = (registry: GlRegistry, name: string, api: string): GlEnum => {
    let untagged: GlEnum | undefined;
    for (const candidate of registry.enums) {
        if (candidate.name !== name) continue;
        if (candidate.api === api) return candidate;
        if (candidate.api === undefined && untagged === undefined) untagged = candidate;
    }
    if (untagged === undefined) {
        throw new Error(`Enum token ${name} has no definition for api "${api}"`);
    }
    return untagged;
};
