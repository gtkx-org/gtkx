import { toCamelIdentifier } from "@gtkx/utils";
import type { InArg, OutArg } from "./args.js";
import type { GlDocContext } from "./doc-context.js";
import type { GlCommand, GlGlx, GlParam } from "./model.js";
import type { CommandPlan, ParamPlan, ReturnPlan } from "./plan.js";
import type { GlSymbolProvenance } from "./select.js";
import { returnPlanTsType, scalarAliasOrGroup } from "./args.js";
import {
    asSentence,
    backtick,
    backtickList,
    commandExportName,
    kindDescriptions,
    metadataNotes,
    type MetadataNotesOptions,
    provenanceLines,
} from "./notes.js";
import { paramPairAt } from "./param-pair.js";

type OkPlan = CommandPlan & { isOk: true };

type ParamPair = {
    param: GlParam;
    paramPlan: ParamPlan;
};

type CommandJsDocOptions = {
    plan: OkPlan;
    provenance: GlSymbolProvenance;
    ins: InArg[];
    outs: OutArg[];
    docs: GlDocContext;
};

type DerivedJsDocOptions = {
    command: GlCommand;
    provenance: GlSymbolProvenance;
    summary: string;
    body: string[];
    docs: GlDocContext;
};

const GROUPED_PLAN_KINDS: Set<string> = new Set(["scalar", "array-in", "ref-out", "ref-array-out"]);
const LENGTHLESS_PLAN_KINDS: Set<string> = new Set(["byte-offset", "byte-offset-array", "ref-out"]);

const OFFSET_NOTES: Map<string, string> = new Map([
    ["byte-offset", "byte offset into the bound buffer"],
    ["byte-offset-array", "byte offsets into the bound buffer"],
]);

const formatPrototype = (command: GlCommand): string => {
    const params = command.params
        .map((param) => (param.cType.endsWith("*") ? `${param.cType}${param.name}` : `${param.cType} ${param.name}`))
        .join(", ");

    return `${command.returnCType} ${command.name}(${params})`;
};

const glxLine = (glx: GlGlx): string => {
    const opcode = ` * GLX ${glx.type} opcode ${glx.opcode}.`;

    return glx.comment === undefined ? opcode : `${opcode} ${asSentence(glx.comment)}`;
};

const aliasLine = (aliases: string[]): string => ` * Also known as ${backtickList(aliases)}.`;

const vectorFormLines = (command: GlCommand, docs: GlDocContext): string[] => {
    const target = command.vecEquiv;

    if (target === undefined || !docs.emittedCommands.has(target)) {
        return [];
    }

    return [` * Vector form: ${backtick(commandExportName(target))}.`];
};

const commandNotes = (command: GlCommand, docs: GlDocContext): string[] => {
    const aliases = docs.aliasTargets.get(command.name) ?? [];

    return [
        ...(command.comment === undefined ? [] : [` * Registry note: ${command.comment}`]),
        ...(aliases.length > 0 ? [aliasLine(aliases)] : []),
        ...vectorFormLines(command, docs),
        ...(command.glx === undefined ? [] : [glxLine(command.glx)]),
    ];
};

const isGroupFolded = (plan: ParamPlan | ReturnPlan, group: string): boolean =>
    GROUPED_PLAN_KINDS.has(plan.kind) &&
    "scalar" in plan &&
    scalarAliasOrGroup(plan.scalar, group) !== plan.scalar.tsAlias;

const groupEntry = (param: GlParam, paramPlan: ParamPlan): { group?: string } =>
    param.group === undefined || isGroupFolded(paramPlan, param.group) ? {} : { group: param.group };

const lengthEntry = (param: GlParam, paramPlan: ParamPlan): { len?: string } =>
    param.len === undefined || LENGTHLESS_PLAN_KINDS.has(paramPlan.kind) ? {} : { len: param.len };

const paramShape = (param: GlParam, paramPlan: ParamPlan, type: string): MetadataNotesOptions => {
    const note = OFFSET_NOTES.get(paramPlan.kind);

    return {
        type,
        ...groupEntry(param, paramPlan),
        ...lengthEntry(param, paramPlan),
        ...(param.objectClass !== undefined && { objectClass: param.objectClass }),
        ...(note !== undefined && { note }),
        kinds: param.kinds,
    };
};

const returnShape = (plan: OkPlan): MetadataNotesOptions => {
    const { command, returnPlan } = plan;
    const group = command.returnGroup;

    return {
        type: returnPlanTsType(returnPlan, group),
        ...(group !== undefined && !isGroupFolded(returnPlan, group) && { group }),
        ...(command.returnObjectClass !== undefined && { objectClass: command.returnObjectClass }),
        kinds: command.returnKinds,
    };
};

const paramPairFor = (plan: OkPlan, argName: string): ParamPair | undefined => {
    const index = plan.command.params.findIndex((candidate) => toCamelIdentifier(candidate.name) === argName);
    const { param, paramPlan } = paramPairAt(plan, index);

    if (param === undefined || paramPlan === undefined) {
        return undefined;
    }

    return { param, paramPlan };
};

const inParamDocLine = (plan: OkPlan, arg: InArg, docs: GlDocContext): string => {
    const pair = paramPairFor(plan, arg.name);

    if (pair === undefined) {
        return ` * @param ${arg.name}`;
    }

    const descriptions = kindDescriptions(pair.param.kinds, docs.kinds);
    const sentence = descriptions.length === 0 ? "" : `. ${descriptions}`;
    const notes = metadataNotes(paramShape(pair.param, pair.paramPlan, arg.tsType));

    return ` * @param ${arg.name} - ${notes}${sentence}`;
};

const outMember = (plan: OkPlan, out: OutArg): string => {
    const { param, paramPlan } = paramPairAt(plan, out.paramIndex);

    if (param === undefined || paramPlan === undefined) {
        throw new Error(`Output parameter index ${String(out.paramIndex)} out of range on ${plan.command.name}`);
    }

    return `${backtick(param.name)} (${metadataNotes(paramShape(param, paramPlan, out.tsType))})`;
};

const returnsDocLine = (plan: OkPlan, outs: OutArg[]): string | undefined => {
    const members = [
        ...(plan.returnPlan.kind === "void" ? [] : [metadataNotes(returnShape(plan))]),
        ...outs.map((out) => outMember(plan, out)),
    ];

    const [single] = members;

    if (single === undefined) {
        return undefined;
    }

    if (members.length === 1) {
        return ` * @returns ${single}`;
    }

    return ` * @returns Tuple of ${members.join(", ")}`;
};

const tagBlock = (tags: string[]): string[] => (tags.length === 0 ? [] : [" *", ...tags]);

const derivedJsDoc = ({ command, provenance, summary, body, docs }: DerivedJsDocOptions): string =>
    [
        "/**",
        ` * ${summary}`,
        " *",
        ...provenanceLines(provenance, docs.extensionCommands.get(command.name) ?? []),
        ...tagBlock(body),
        " */",
    ].join("\n");

const commandJsDoc = ({ plan, provenance, ins, outs, docs }: CommandJsDocOptions): string => {
    const { command } = plan;
    const returnsLine = returnsDocLine(plan, outs);

    const tags = [
        ...ins.map((arg) => inParamDocLine(plan, arg, docs)),
        ...(returnsLine === undefined ? [] : [returnsLine]),
    ];

    return [
        "/**",
        ` * ${backtick(formatPrototype(command))}`,
        " *",
        ...provenanceLines(provenance, docs.extensionCommands.get(command.name) ?? []),
        ...commandNotes(command, docs),
        ...tagBlock(tags),
        " */",
    ].join("\n");
};

export { commandJsDoc, derivedJsDoc, inParamDocLine };
