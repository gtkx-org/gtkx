import { sanitizeIdentifier, sortStrings, sortStringsBy } from "@gtkx/utils";
import { type GlEnum, loadGlRegistry } from "./model.js";
import { renderCommandsModule, renderEnumsModule, renderTypesModule } from "./modules.js";
import { paramPairAt } from "./param-pair.js";
import {
    type CommandPlan,
    type GlExclusionReason,
    type GlPlanPolicy,
    type GlScalar,
    type ParamPlan,
    planCommand,
} from "./plan.js";
import { deriveDeleteSingular, deriveGenSingular, renderCommand, type RenderedCommand } from "./render.js";
import { type GlSelection, resolveEnum, selectSubset } from "./select.js";

type GlExclusion = {
    command: string;
    reason: GlExclusionReason;
};

type GlGenerationReport = {
    selection: GlSelection;
    selectedCommands: number;
    emittedCommands: number;
    derivedSingulars: number;
    exclusions: GlExclusion[];
};

type GlGenerationResult = {
    files: Map<string, string>;
    report: GlGenerationReport;
};

type GroupBearingParamPlan = Extract<ParamPlan, { kind: "scalar" | "array-in" | "ref-out" }>;

type GlGenerationOptions = {
    registryPath: string;
    overrideExports: Set<string>;
};

type OkPlan = CommandPlan & { ok: true };

type PlannedSelection = {
    okPlans: OkPlan[];
    planFeatures: Map<string, string>;
    exclusions: GlExclusion[];
};

type EnumRow = {
    token: GlEnum;
    exportName: string;
    literal: string;
    feature: string;
};

const BYTE_OFFSET_PARAMS: Set<string> = new Set([
    "glVertexAttribPointer:pointer",
    "glVertexAttribIPointer:pointer",
    "glVertexAttribLPointer:pointer",
    "glDrawElements:indices",
    "glDrawRangeElements:indices",
    "glDrawElementsBaseVertex:indices",
    "glDrawRangeElementsBaseVertex:indices",
    "glDrawElementsInstanced:indices",
    "glDrawElementsInstancedBaseVertex:indices",
    "glDrawElementsInstancedBaseInstance:indices",
    "glDrawElementsInstancedBaseVertexBaseInstance:indices",
    "glMultiDrawElements:indices",
    "glMultiDrawElementsBaseVertex:indices",
    "glDrawArraysIndirect:indirect",
    "glDrawElementsIndirect:indirect",
    "glMultiDrawArraysIndirect:indirect",
    "glMultiDrawElementsIndirect:indirect",
]);

const SINGLE_VALUED_QUERIES: Set<string> = new Set([
    "glGetShaderiv",
    "glGetProgramiv",
    "glGetProgramPipelineiv",
    "glGetBufferParameteriv",
    "glGetBufferParameteri64v",
    "glGetRenderbufferParameteriv",
    "glGetFramebufferParameteriv",
    "glGetFramebufferAttachmentParameteriv",
    "glGetQueryiv",
    "glGetQueryObjectiv",
    "glGetQueryObjectuiv",
    "glGetQueryObjecti64v",
    "glGetQueryObjectui64v",
    "glGetTransformFeedbackiv",
    "glGetVertexArrayiv",
]);

const OVERRIDE_OWNED: Set<string> = new Set([
    "glGetShaderInfoLog",
    "glGetProgramInfoLog",
    "glGetProgramPipelineInfoLog",
]);

const PLAN_POLICY: GlPlanPolicy = {
    byteOffsetParams: BYTE_OFFSET_PARAMS,
    singleValuedQueries: SINGLE_VALUED_QUERIES,
};

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const GROUP_BEARING_PARAM_KINDS: Set<ParamPlan["kind"]> = new Set(["scalar", "array-in", "ref-out"]);
const GL_SELECTION: GlSelection = { api: "gl", version: 4.6, profile: "core" };

const enumExportName = (name: string): string =>
    sanitizeIdentifier((name.startsWith("GL_") ? name.slice(3) : name).toUpperCase());

const enumLiteral = (token: GlEnum): string | undefined => {
    const text = token.value.trim();
    let value: bigint;

    try {
        value = BigInt(text);
    } catch {
        return undefined;
    }

    if (value > MAX_SAFE) {
        return undefined;
    }

    if (/^0[xX]/.test(text)) {
        return `0x${text.slice(2).toLowerCase()}`;
    }

    return text;
};

const groupAliasValue = (existing: string | undefined, scalarAlias: string): string => {
    if (scalarAlias === "GLbitfield") {
        return "GLbitfield";
    }

    return existing ?? "GLenum";
};

const mergeGroupAlias = (aliases: Map<string, string>, scalar: GlScalar, group: string | undefined): void => {
    if (group === undefined) {
        return;
    }

    if (scalar.groupBearing !== true) {
        return;
    }

    const existing = aliases.get(group);

    if (existing === "GLbitfield") {
        return;
    }

    aliases.set(group, groupAliasValue(existing, scalar.tsAlias));
};

const isGroupBearingParam = (paramPlan: ParamPlan): paramPlan is GroupBearingParamPlan =>
    GROUP_BEARING_PARAM_KINDS.has(paramPlan.kind);

const considerParamGroup = (aliases: Map<string, string>, plan: OkPlan, index: number): void => {
    const { paramPlan, param } = paramPairAt(plan, index);

    if (paramPlan === undefined || param === undefined) {
        return;
    }

    if (isGroupBearingParam(paramPlan)) {
        mergeGroupAlias(aliases, paramPlan.scalar, param.group);
    }
};

const collectPlanGroups = (aliases: Map<string, string>, plan: OkPlan): void => {
    for (let index = 0; index < plan.params.length; index++) {
        considerParamGroup(aliases, plan, index);
    }

    if (plan.returnPlan.kind === "scalar") {
        mergeGroupAlias(aliases, plan.returnPlan.scalar, plan.command.returnGroup);
    }
};

const collectGroupAliases = (plans: OkPlan[]): Map<string, string> => {
    const aliases: Map<string, string> = new Map();

    for (const plan of plans) {
        collectPlanGroups(aliases, plan);
    }

    return aliases;
};

const planSelectedCommand = (registry: ReturnType<typeof loadGlRegistry>, name: string): OkPlan | GlExclusion => {
    const command = registry.commands.get(name);

    if (command === undefined) {
        throw new Error(`Selected command ${name} is not defined in the registry`);
    }

    if (OVERRIDE_OWNED.has(name)) {
        return { command: name, reason: "override-owned" };
    }

    const plan = planCommand(command, PLAN_POLICY);

    if (!plan.ok) {
        return { command: name, reason: plan.reason };
    }

    return plan;
};

const planSelectedCommands = (
    registry: ReturnType<typeof loadGlRegistry>,
    commandNames: Map<string, string>,
): PlannedSelection => {
    const exclusions: GlExclusion[] = [];
    const okPlans: OkPlan[] = [];
    const planFeatures: Map<string, string> = new Map();
    const sortedCommands = sortStringsBy(commandNames.entries(), ([key]) => key);

    for (const [name, feature] of sortedCommands) {
        const result = planSelectedCommand(registry, name);

        if ("ok" in result) {
            okPlans.push(result);
            planFeatures.set(name, feature);
        } else {
            exclusions.push(result);
        }
    }

    return { okPlans, planFeatures, exclusions };
};

const buildEnumRows = (registry: ReturnType<typeof loadGlRegistry>, enumNames: Map<string, string>): EnumRow[] => {
    const enumRows: EnumRow[] = [];
    const sortedEnums = sortStringsBy(enumNames.entries(), ([key]) => key);

    for (const [name, feature] of sortedEnums) {
        const token = resolveEnum(registry, name);
        const literal = enumLiteral(token);

        if (literal === undefined) {
            continue;
        }

        enumRows.push({ token, exportName: enumExportName(name), literal, feature });
    }

    return enumRows;
};

const claimExportName = (exportNames: Map<string, string>, name: string, owner: string): void => {
    const existing = exportNames.get(name);

    if (existing !== undefined) {
        throw new Error(`Generated export name collision: ${name} (${existing} vs ${owner})`);
    }

    exportNames.set(name, owner);
};

const assertExportNamesDisjoint = (
    rendered: RenderedCommand[],
    singulars: RenderedCommand[],
    enumRows: EnumRow[],
    overrideExports: Set<string>,
): void => {
    const exportNames: Map<string, string> = new Map();

    for (const command of rendered) {
        claimExportName(exportNames, command.exportName, "command");
    }

    for (const singular of singulars) {
        claimExportName(exportNames, singular.exportName, "derived singular");
    }

    for (const row of enumRows) {
        claimExportName(exportNames, row.exportName, "enum constant");
    }

    const overrideCollisions = exportNames
        .keys()
        .filter((name) => overrideExports.has(name))
        .toArray();

    if (overrideCollisions.length > 0) {
        throw new Error(
            `Override module exports collide with generated exports: ${sortStrings(overrideCollisions).join(", ")}`,
        );
    }
};

const generateGlModules = (options: GlGenerationOptions): GlGenerationResult => {
    const selection = GL_SELECTION;
    const registry = loadGlRegistry(options.registryPath);
    const subset = selectSubset(registry, selection);
    const { okPlans, planFeatures, exclusions } = planSelectedCommands(registry, subset.commands);
    const usedTypes: Set<string> = new Set();
    const rendered: RenderedCommand[] = [];
    const singulars: RenderedCommand[] = [];

    for (const plan of okPlans) {
        const feature = planFeatures.get(plan.command.name) ?? "unknown feature";
        rendered.push(renderCommand(plan, feature, usedTypes));
        const singular = deriveGenSingular(plan, feature, usedTypes) ?? deriveDeleteSingular(plan, feature, usedTypes);

        if (singular !== undefined) {
            singulars.push(singular);
        }
    }

    const enumRows = buildEnumRows(registry, subset.enums);
    assertExportNamesDisjoint(rendered, singulars, enumRows, options.overrideExports);

    const files: Map<string, string> = new Map([
        ["types.ts", renderTypesModule(collectGroupAliases(okPlans))],
        ["enums.ts", renderEnumsModule(enumRows)],
        ["commands.ts", renderCommandsModule(rendered, singulars, usedTypes)],
    ]);

    return {
        files,
        report: {
            selection,
            selectedCommands: subset.commands.size,
            emittedCommands: rendered.length,
            derivedSingulars: singulars.length,
            exclusions,
        },
    };
};

export { generateGlModules, type GlGenerationReport, type GlGenerationResult };
