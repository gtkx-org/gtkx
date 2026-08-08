import { sortStrings } from "@gtkx/utils";
import type { GlExtensionAttribution, GlExtensionIndex } from "./extensions.js";
import type { GlEnum, GlRegistry, GlType } from "./model.js";
import type { CommandPlan } from "./plan.js";

type GlDocEnumRow = {
    token: GlEnum;
    exportName: string;
};

type GlDocContext = {
    registryComment?: string;
    kinds: Map<string, string>;
    types: Map<string, GlType>;
    aliasTargets: Map<string, string[]>;
    extensionCommands: Map<string, GlExtensionAttribution[]>;
    extensionEnums: Map<string, GlExtensionAttribution[]>;
    bitmaskGroups: Set<string>;
    emittedCommands: Set<string>;
    groupMembers: Map<string, string[]>;
};

type BuildDocContextOptions = {
    registry: GlRegistry;
    extensions: GlExtensionIndex;
    plans: (CommandPlan & { isOk: true })[];
    enumRows: GlDocEnumRow[];
};

const buildGroupMembers = (rows: GlDocEnumRow[]): Map<string, string[]> => {
    const members: Map<string, string[]> = new Map();

    for (const row of rows) {
        for (const group of row.token.groups) {
            members.set(group, [...(members.get(group) ?? []), row.exportName]);
        }
    }

    for (const [group, names] of members) {
        members.set(group, sortStrings(names));
    }

    return members;
};

const buildDocContext = (options: BuildDocContextOptions): GlDocContext => {
    const { registry, extensions, plans, enumRows } = options;

    return {
        ...(registry.comment !== undefined && { registryComment: registry.comment }),
        kinds: registry.kinds,
        types: registry.types,
        aliasTargets: registry.aliasTargets,
        extensionCommands: extensions.commands,
        extensionEnums: extensions.enums,
        bitmaskGroups: registry.bitmaskGroups,
        emittedCommands: new Set(plans.map((plan) => plan.command.name)),
        groupMembers: buildGroupMembers(enumRows),
    };
};

export { buildDocContext, type GlDocContext };
