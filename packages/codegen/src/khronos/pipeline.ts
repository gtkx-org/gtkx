import { sanitizeIdentifier, sortedStrings, sortedStringsBy } from "@gtkx/utils";
import { transpileSource } from "../transpile.js";
import { type GlEnum, loadGlRegistry } from "./model.js";
import { renderCommandsModule, renderEnumsModule, renderTypesModule } from "./modules.js";
import { type CommandPlan, type GlExclusionReason, type GlPlanPolicy, type GlScalar, planCommand } from "./plan.js";
import { deriveDeleteSingular, deriveGenSingular, type RenderedCommand, renderCommand } from "./render.js";
import { type GlSelection, resolveEnum, selectSubset } from "./select.js";

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

const COMPANION_OWNED: Set<string> = new Set([
    "glGetShaderInfoLog",
    "glGetProgramInfoLog",
    "glGetProgramPipelineInfoLog",
]);

const PLAN_POLICY: GlPlanPolicy = {
    byteOffsetParams: BYTE_OFFSET_PARAMS,
    singleValuedQueries: SINGLE_VALUED_QUERIES,
};

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

export type GlGenerationResult = {
    files: Map<string, string>;
    report: GlGenerationReport;
};

const enumExportName = (name: string): string =>
    sanitizeIdentifier((name.startsWith("GL_") ? name.slice(3) : name).toUpperCase());

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const enumLiteral = (token: GlEnum): string | undefined => {
    const text = token.value.trim();
    let value: bigint;
    try {
        value = BigInt(text);
    } catch {
        return undefined;
    }
    if (value > MAX_SAFE) return undefined;
    if (/^0[xX]/.test(text)) return `0x${text.slice(2).toLowerCase()}`;
    return text;
};

const collectGroupAliases = (plans: (CommandPlan & { ok: true })[]): Map<string, string> => {
    const aliases = new Map<string, string>();
    const consider = (scalar: GlScalar, group: string | undefined): void => {
        if (group === undefined) return;
        if (scalar.groupBearing !== true) return;
        const existing = aliases.get(group);
        if (existing === "GLbitfield") return;
        aliases.set(group, scalar.tsAlias === "GLbitfield" ? "GLbitfield" : (existing ?? "GLenum"));
    };
    for (const plan of plans) {
        plan.params.forEach((paramPlan, index) => {
            const param = plan.command.params[index];
            if (param === undefined) return;
            if (paramPlan.kind === "scalar" || paramPlan.kind === "array-in" || paramPlan.kind === "ref-out") {
                consider(paramPlan.scalar, param.group);
            }
        });
        if (plan.returnPlan.kind === "scalar") consider(plan.returnPlan.scalar, plan.command.returnGroup);
    }
    return aliases;
};

type GlGenerationOptions = {
    registryPath: string;
    companionExports: Set<string>;
};

const GL_SELECTION: GlSelection = { api: "gl", version: 4.6, profile: "core" };

type OkPlan = CommandPlan & { ok: true };

type PlannedSelection = {
    okPlans: OkPlan[];
    planFeatures: Map<string, string>;
    exclusions: GlExclusion[];
};

const planSelectedCommands = (
    registry: ReturnType<typeof loadGlRegistry>,
    commandNames: Map<string, string>,
): PlannedSelection => {
    const exclusions: GlExclusion[] = [];
    const okPlans: OkPlan[] = [];
    const planFeatures = new Map<string, string>();
    for (const [name, feature] of sortedStringsBy(commandNames.entries(), ([key]) => key)) {
        const command = registry.commands.get(name);
        if (command === undefined) throw new Error(`Selected command ${name} is not defined in the registry`);
        if (COMPANION_OWNED.has(name)) {
            exclusions.push({ command: name, reason: "companion-owned" });
            continue;
        }
        const plan = planCommand(command, PLAN_POLICY);
        if (!plan.ok) {
            exclusions.push({ command: name, reason: plan.reason });
            continue;
        }
        okPlans.push(plan);
        planFeatures.set(name, feature);
    }
    return { okPlans, planFeatures, exclusions };
};

type EnumRow = {
    token: GlEnum;
    exportName: string;
    literal: string;
    feature: string;
};

const buildEnumRows = (registry: ReturnType<typeof loadGlRegistry>, enumNames: Map<string, string>): EnumRow[] => {
    const enumRows: EnumRow[] = [];
    for (const [name, feature] of sortedStringsBy(enumNames.entries(), ([key]) => key)) {
        const token = resolveEnum(registry, name);
        const literal = enumLiteral(token);
        if (literal === undefined) continue;
        enumRows.push({ token, exportName: enumExportName(name), literal, feature });
    }
    return enumRows;
};

const assertExportNamesDisjoint = (
    rendered: RenderedCommand[],
    singulars: RenderedCommand[],
    enumRows: EnumRow[],
    companionExports: Set<string>,
): void => {
    const exportNames = new Map<string, string>();
    const claim = (name: string, owner: string): void => {
        const existing = exportNames.get(name);
        if (existing !== undefined) {
            throw new Error(`Generated export name collision: ${name} (${existing} vs ${owner})`);
        }
        exportNames.set(name, owner);
    };
    for (const command of rendered) claim(command.exportName, "command");
    for (const singular of singulars) claim(singular.exportName, "derived singular");
    for (const row of enumRows) claim(row.exportName, "enum constant");

    const companionCollisions = [...exportNames.keys()].filter((name) => companionExports.has(name));
    if (companionCollisions.length > 0) {
        throw new Error(
            `Companion module exports collide with generated exports: ${sortedStrings(companionCollisions).join(", ")}`,
        );
    }
};

export const generateGlModules = (options: GlGenerationOptions): GlGenerationResult => {
    const selection = GL_SELECTION;
    const registry = loadGlRegistry(options.registryPath);
    const subset = selectSubset(registry, selection);
    const { okPlans, planFeatures, exclusions } = planSelectedCommands(registry, subset.commands);

    const usedTypes = new Set<string>();
    const rendered: RenderedCommand[] = [];
    const singulars: RenderedCommand[] = [];
    for (const plan of okPlans) {
        const feature = planFeatures.get(plan.command.name) ?? "unknown feature";
        rendered.push(renderCommand(plan, feature, usedTypes));
        const singular = deriveGenSingular(plan, feature, usedTypes) ?? deriveDeleteSingular(plan, feature, usedTypes);
        if (singular !== undefined) singulars.push(singular);
    }

    const enumRows = buildEnumRows(registry, subset.enums);
    assertExportNamesDisjoint(rendered, singulars, enumRows, options.companionExports);

    const files = new Map<string, string>([
        ["types.ts", renderTypesModule(collectGroupAliases(okPlans))],
        ["enums.ts", renderEnumsModule(enumRows)],
        ["commands.ts", renderCommandsModule(rendered, singulars, usedTypes)],
    ]);
    for (const [fileName, source] of files) {
        transpileSource(fileName, source);
    }

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
