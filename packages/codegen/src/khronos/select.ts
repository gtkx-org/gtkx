import { sortStringsBy } from "@gtkx/utils";
import type { GlEnum, GlFeature, GlInterfaceBlock, GlRegistry } from "./model.js";

type GlProfile = "core";

type GlSelection = {
    api: string;
    version: number;
    profile: GlProfile;
};

type GlSymbolKind = "command" | "enum";

type GlRemoval = {
    feature: string;
    comment?: string;
};

type GlSymbolProvenance = {
    feature: string;
    requireComment?: string;
    removals: GlRemoval[];
};

type GlRemovedSymbol = {
    name: string;
    kind: GlSymbolKind;
    feature: string;
    comment?: string;
};

type GlSubset = {
    commands: Map<string, GlSymbolProvenance>;
    enums: Map<string, GlSymbolProvenance>;
    removed: GlRemovedSymbol[];
};

type SelectionState = GlSubset & {
    history: Map<string, GlRemoval[]>;
};

type MemberContext = {
    feature: GlFeature;
    block: GlInterfaceBlock;
    kind: GlSymbolKind;
};

const isBlockApplicable = (block: GlInterfaceBlock, selection: GlSelection): boolean =>
    (block.profile === undefined || block.profile === selection.profile) &&
    (block.api === undefined || block.api === selection.api);

const targetFor = (state: SelectionState, kind: GlSymbolKind): Map<string, GlSymbolProvenance> =>
    kind === "command" ? state.commands : state.enums;

const commentEntry = (comment: string | undefined): { comment?: string } =>
    comment === undefined ? {} : { comment };

const requireMember = (state: SelectionState, name: string, context: MemberContext): void => {
    const target = targetFor(state, context.kind);

    if (target.has(name)) {
        return;
    }

    const { block, feature } = context;

    target.set(name, {
        feature: feature.name,
        ...(block.comment !== undefined && { requireComment: block.comment }),
        removals: [...(state.history.get(name) ?? [])],
    });
};

const removeMember = (state: SelectionState, name: string, context: MemberContext): void => {
    const { block, feature, kind } = context;
    const removal: GlRemoval = { feature: feature.name, ...commentEntry(block.comment) };
    targetFor(state, kind).delete(name);
    state.history.set(name, [...(state.history.get(name) ?? []), removal]);
    state.removed.push({ name, kind, ...removal });
};

const applyMembers = (state: SelectionState, names: string[], context: MemberContext): void => {
    const apply = context.block.kind === "require" ? requireMember : removeMember;

    for (const name of names) {
        apply(state, name, context);
    }
};

const applyBlock = (state: SelectionState, feature: GlFeature, block: GlInterfaceBlock): void => {
    applyMembers(state, block.commands, { feature, block, kind: "command" });
    applyMembers(state, block.enums, { feature, block, kind: "enum" });
};

const applyFeature = (state: SelectionState, feature: GlFeature, selection: GlSelection): void => {
    for (const block of feature.blocks) {
        if (isBlockApplicable(block, selection)) {
            applyBlock(state, feature, block);
        }
    }
};

const selectSubset = (registry: GlRegistry, selection: GlSelection): GlSubset => {
    const features = registry.features
        .filter((feature) => feature.api === selection.api && feature.number <= selection.version)
        .toSorted((a, b) => a.number - b.number);

    const state: SelectionState = {
        commands: new Map(),
        enums: new Map(),
        removed: [],
        history: new Map(),
    };

    for (const feature of features) {
        applyFeature(state, feature, selection);
    }

    return {
        commands: state.commands,
        enums: state.enums,
        removed: sortStringsBy(state.removed, (entry) => entry.name),
    };
};

const resolveEnum = (registry: GlRegistry, name: string, api: string): GlEnum => {
    const found = registry.enums.find(
        (candidate) => candidate.name === name && (candidate.api === undefined || candidate.api === api),
    );

    if (found === undefined) {
        throw new Error(`Enum token ${name} has no definition in the registry`);
    }

    return found;
};

export { selectSubset, resolveEnum, type GlRemoval, type GlSelection, type GlSubset, type GlSymbolProvenance };
