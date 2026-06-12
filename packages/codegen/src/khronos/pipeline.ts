/**
 * Emission pipeline for the Khronos GL generator.
 *
 * Orchestrates registry loading, feature selection, command planning, and the
 * rendering of the three generated `@gtkx/gl` source modules:
 *
 * - `types.ts` — scalar aliases, opaque handles, and enum-group aliases
 * - `enums.ts` — one exported constant per selected enum token
 * - `commands.ts` — one `t.fn` binding plus one typed export per command,
 *   with mechanically derived singular forms of the gen/create/delete
 *   object-name families
 *
 * Output parameters follow the GIR bindings' convention: they are dropped
 * from the TypeScript signature, marshalled through internal `{ value }`
 * cells, and surfaced as the return value — bare when the C return is `void`
 * and exactly one output exists, otherwise as a tuple of the wrapped C return
 * followed by each output in declaration order.
 *
 * Every emitted module is validated through {@link transpileSource} so an
 * isolated-declarations regression fails generation instead of landing in the
 * committed output.
 */
import { toIdentifier } from "@gtkx/utils";
import { ModuleBuilder } from "../dsl/module.js";
import { transpileSource } from "../transpile.js";
import {
    type CommandPlan,
    GL_SCALARS,
    type GlExclusionReason,
    type GlPlanPolicy,
    type GlScalar,
    type ParamPlan,
    planCommand,
    type ReturnPlan,
} from "./ctype.js";
import { type GlCommand, type GlEnum, loadGlRegistry } from "./model.js";
import { type GlSelection, resolveEnum, selectSubset } from "./select.js";

const LIB_CONSTANT = `const LIB = "libGL.so.1";`;
const REFPAGES_BASE = "https://registry.khronos.org/OpenGL-Refpages/gl4/html";

/**
 * `command:param` pairs whose `void *` argument is a byte offset into the
 * bound buffer object. Typing them as plain numbers removes the raw-GL
 * footgun of a typed array silently becoming a dangling client pointer at
 * draw time; genuine data parameters stay `t.blob`. Pinned-registry safe.
 */
const BYTE_OFFSET_PARAMS: ReadonlySet<string> = new Set([
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

/**
 * Object-scoped query commands whose `COMPSIZE(pname)`-sized output is
 * single-valued for every `pname` the gl 4.6 core profile allows, generated
 * with a scalar out-cell. The general `COMPSIZE(pname)` output rule stays an
 * exclusion — vector-returning state queries corrupt memory when treated as
 * single-valued. Pinned-registry safe.
 */
const SINGLE_VALUED_QUERIES: ReadonlySet<string> = new Set([
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

/**
 * Commands the hand-written companion module owns under their WebGL-style
 * names (string-returning info-log helpers). Excluded from generation so the
 * export name sets stay disjoint.
 */
const COMPANION_OWNED: ReadonlySet<string> = new Set([
    "glGetShaderInfoLog",
    "glGetProgramInfoLog",
    "glGetProgramPipelineInfoLog",
]);

const PLAN_POLICY: GlPlanPolicy = {
    byteOffsetParams: BYTE_OFFSET_PARAMS,
    singleValuedQueries: SINGLE_VALUED_QUERIES,
};

/** One excluded command and why. */
export type GlExclusion = {
    /** The C entry point name. */
    readonly command: string;
    /** The exclusion category. */
    readonly reason: GlExclusionReason;
    /** The offending parameter and shape. */
    readonly detail: string;
};

/** Counts and exclusion lists for one generation run. */
export type GlGenerationReport = {
    /** The resolved selection. */
    readonly selection: GlSelection;
    /** Commands the selection resolved to. */
    readonly selectedCommands: number;
    /** Commands emitted as typed exports. */
    readonly emittedCommands: number;
    /** Mechanically derived singular exports. */
    readonly derivedSingulars: number;
    /** Enum tokens the selection resolved to. */
    readonly selectedEnums: number;
    /** Enum constants emitted. */
    readonly emittedEnums: number;
    /** Commands excluded from generation, with reasons. */
    readonly exclusions: readonly GlExclusion[];
    /** Enum tokens skipped, with reasons. */
    readonly skippedEnums: readonly { readonly name: string; readonly reason: string }[];
};

/** The output of one generation run: sources keyed by filename, plus counts. */
export type GlGenerationResult = {
    /** Generated TypeScript sources keyed by output filename. */
    readonly files: ReadonlyMap<string, string>;
    /** Counts and exclusions for the run. */
    readonly report: GlGenerationReport;
};

const GENERATED_HEADER = `/**
 * GENERATED FILE — do not edit.
 *
 * Emitted by the \`@gtkx/codegen\` Khronos generator from the vendored
 * \`registry/gl.xml\` (gl 4.6 core profile). Regenerate with
 * \`pnpm --filter @gtkx/codegen codegen:gl\`.
 */`;

const lowerFirst = (name: string): string => name.charAt(0).toLowerCase() + name.slice(1);

const commandExportName = (name: string): string => {
    const stripped = name.startsWith("gl") ? lowerFirst(name.slice(2)) : name;
    return /^[0-9]/.test(stripped) ? name : toIdentifier(stripped);
};

const enumExportName = (name: string): string => {
    const stripped = name.startsWith("GL_") ? name.slice(3) : name;
    return /^[0-9]/.test(stripped) ? name : toIdentifier(stripped);
};

const singularize = (plural: string): string =>
    plural.endsWith("ies") ? `${plural.slice(0, -3)}y` : plural.replace(/s$/, "");

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const enumLiteral = (token: GlEnum): string | undefined => {
    const text = token.value.trim();
    const negative = text.startsWith("-");
    const magnitudeText = negative ? text.slice(1) : text;
    let magnitude: bigint;
    try {
        magnitude = BigInt(magnitudeText);
    } catch {
        return undefined;
    }
    if (magnitude > MAX_SAFE) return undefined;
    if (/^0[xX]/.test(magnitudeText)) {
        return `${negative ? "-" : ""}0x${magnitudeText.slice(2).toLowerCase()}`;
    }
    return text;
};

const scalarAliasOrGroup = (scalar: GlScalar, group: string | undefined): string =>
    group !== undefined && (scalar.tsAlias === "GLenum" || scalar.tsAlias === "GLbitfield") ? group : scalar.tsAlias;

const paramIndexByName = (command: GlCommand, name: string): number => {
    const index = command.params.findIndex((param) => param.name === name);
    if (index < 0) throw new Error(`Command ${command.name} has no parameter named ${name}`);
    return index;
};

const arrayInTsType = (scalar: GlScalar, group: string | undefined): string => {
    const element = scalarAliasOrGroup(scalar, group);
    return scalar.viewType === undefined ? `readonly ${element}[]` : `readonly ${element}[] | ${scalar.viewType}`;
};

/** An input parameter: surfaced in the signature and passed through. */
type EmittedIn = {
    readonly out: false;
    readonly name: string;
    readonly tsType: string;
    readonly descriptor: string;
};

/** An output parameter: marshalled through an internal cell and returned. */
type EmittedOut = {
    readonly out: true;
    readonly cellName: string;
    readonly seed: string;
    readonly tsType: string;
    readonly descriptor: string;
    readonly docName: string;
    readonly docCType: string;
};

type EmittedSlot = EmittedIn | EmittedOut;

type BuildSlotOptions = {
    readonly command: GlCommand;
    readonly index: number;
    readonly plan: ParamPlan;
    readonly outIndex: number;
    readonly usedTypes: Set<string>;
};

const inSlot = (name: string, tsType: string, descriptor: string): EmittedIn => ({
    out: false,
    name,
    tsType,
    descriptor,
});

const buildInSlot = (options: BuildSlotOptions, name: string, use: (alias: string) => string): EmittedIn => {
    const { command, index, plan } = options;
    const param = command.params[index];
    if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${command.name}`);
    switch (plan.kind) {
        case "scalar":
            return inSlot(name, use(scalarAliasOrGroup(plan.scalar, param.group)), `{ type: ${plan.scalar.tExpr} }`);
        case "boolean":
            return inSlot(name, "boolean", "{ type: t.boolean }");
        case "sync":
            return inSlot(name, use("GLsync"), `{ type: t.struct("borrowed") }`);
        case "string-in":
            return inSlot(name, "string", `{ type: t.string("borrowed") }`);
        case "string-array-in":
            return inSlot(name, "readonly string[]", `{ type: t.array(t.string("borrowed")) }`);
        case "array-in": {
            use(scalarAliasOrGroup(plan.scalar, param.group));
            return inSlot(name, arrayInTsType(plan.scalar, param.group), `{ type: t.array(${plan.scalar.tExpr}) }`);
        }
        case "blob":
            return inSlot(name, `ArrayBufferView | ${use("GLintptr")} | null`, "{ type: t.blob }");
        case "byte-offset":
            return inSlot(name, use("GLintptr"), "{ type: t.uint64 }");
        case "byte-offset-array":
            return inSlot(name, `readonly ${use("GLintptr")}[]`, "{ type: t.array(t.uint64) }");
        default:
            throw new Error(`Plan kind ${plan.kind} is not an input parameter`);
    }
};

const buildOutSlot = (options: BuildSlotOptions, use: (alias: string) => string): EmittedOut => {
    const { command, index, plan, outIndex } = options;
    const param = command.params[index];
    if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${command.name}`);
    const cellName = `out${outIndex}`;
    switch (plan.kind) {
        case "ref-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: 0 };`,
                tsType: use(scalarAliasOrGroup(plan.scalar, param.group)),
                descriptor: `{ type: t.ref(${plan.scalar.tExpr}) }`,
                docName: param.name,
                docCType: param.cType,
            };
        case "ref-array-out": {
            const sizeIndex = paramIndexByName(command, plan.lenParamName);
            const lenIdentifier = toIdentifier(plan.lenParamName);
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${lenIdentifier}).fill(0) };`,
                tsType: `${use(plan.scalar.tsAlias)}[]`,
                descriptor: `{ type: t.ref(t.sizedArray(${plan.scalar.tExpr}, ${sizeIndex})) }`,
                docName: param.name,
                docCType: param.cType,
            };
        }
        case "ref-fixed-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: new Array<number>(${plan.length}).fill(0) };`,
                tsType: `${use(plan.scalar.tsAlias)}[]`,
                descriptor: `{ type: t.ref(t.fixedArray(${plan.scalar.tExpr}, ${plan.length})) }`,
                docName: param.name,
                docCType: param.cType,
            };
        case "string-out":
            return {
                out: true,
                cellName,
                seed: `const ${cellName} = { value: "" };`,
                tsType: "string",
                descriptor: `{ type: t.ref(t.string("borrowed", ${toIdentifier(plan.lenParamName)})) }`,
                docName: param.name,
                docCType: param.cType,
            };
        default:
            throw new Error(`Plan kind ${plan.kind} is not an output parameter`);
    }
};

const isOutPlan = (plan: ParamPlan): boolean =>
    plan.kind === "ref-out" ||
    plan.kind === "ref-array-out" ||
    plan.kind === "ref-fixed-out" ||
    plan.kind === "string-out";

const buildSlots = (
    plan: CommandPlan & { readonly ok: true },
    usedTypes: Set<string>,
): { slots: EmittedSlot[]; ins: EmittedIn[]; outs: EmittedOut[] } => {
    const use = (alias: string): string => {
        usedTypes.add(alias);
        return alias;
    };
    const slots: EmittedSlot[] = [];
    const ins: EmittedIn[] = [];
    const outs: EmittedOut[] = [];
    plan.params.forEach((paramPlan, index) => {
        const param = plan.command.params[index];
        if (param === undefined) throw new Error(`Parameter index ${index} out of range on ${plan.command.name}`);
        const options: BuildSlotOptions = {
            command: plan.command,
            index,
            plan: paramPlan,
            outIndex: outs.length,
            usedTypes,
        };
        if (isOutPlan(paramPlan)) {
            const slot = buildOutSlot(options, use);
            slots.push(slot);
            outs.push(slot);
        } else {
            const slot = buildInSlot(options, toIdentifier(param.name), use);
            slots.push(slot);
            ins.push(slot);
        }
    });
    return { slots, ins, outs };
};

type EmittedReturn = {
    readonly tsType: string;
    readonly descriptor: string;
    readonly expr?: (call: string) => string;
};

const buildEmittedReturn = (
    plan: ReturnPlan,
    returnGroup: string | undefined,
    usedTypes: Set<string>,
): EmittedReturn => {
    const use = (alias: string): string => {
        usedTypes.add(alias);
        return alias;
    };
    switch (plan.kind) {
        case "void":
            return { tsType: "void", descriptor: "t.void" };
        case "scalar": {
            const alias = use(scalarAliasOrGroup(plan.scalar, returnGroup));
            return { tsType: alias, descriptor: plan.scalar.tExpr, expr: (call) => `${call} as ${alias}` };
        }
        case "boolean":
            return { tsType: "boolean", descriptor: "t.uint8", expr: (call) => `(${call} as number) !== 0` };
        case "string":
            return { tsType: "string", descriptor: `t.string("borrowed")`, expr: (call) => `${call} as string` };
        case "sync":
            return { tsType: use("GLsync"), descriptor: `t.struct("borrowed")`, expr: (call) => `${call} as GLsync` };
        case "opaque-pointer":
            return {
                tsType: use("GLpointer"),
                descriptor: `t.struct("borrowed")`,
                expr: (call) => `${call} as GLpointer`,
            };
    }
};

const formatPrototype = (command: GlCommand): string => {
    const params = command.params
        .map((param) => (param.cType.endsWith("*") ? `${param.cType}${param.name}` : `${param.cType} ${param.name}`))
        .join(", ");
    return `${command.returnCType} ${command.name}(${params})`;
};

const inParamDocLine = (command: GlCommand, slot: EmittedIn): string => {
    const param = command.params.find((candidate) => toIdentifier(candidate.name) === slot.name);
    if (param === undefined) return ` * @param ${slot.name}`;
    const notes: string[] = [`\`${param.cType}\``];
    if (param.group !== undefined) notes.push(`group \`${param.group}\``);
    if (param.len !== undefined) notes.push(`length \`${param.len}\``);
    if (param.kind !== undefined) notes.push(`object kind \`${param.kind}\``);
    return ` * @param ${slot.name} - ${notes.join(", ")}`;
};

const returnsDocLine = (
    command: GlCommand,
    returnPlan: ReturnPlan,
    outs: readonly EmittedOut[],
): string | undefined => {
    const members: string[] = [];
    if (returnPlan.kind !== "void") members.push(`\`${command.returnCType}\``);
    for (const out of outs) members.push(`\`${out.docName}\` (\`${out.docCType}\`)`);
    if (members.length === 0) return undefined;
    if (members.length === 1) return ` * @returns ${members[0]}`;
    return ` * @returns Tuple of ${members.join(", ")}`;
};

type CommandJsDocOptions = {
    readonly command: GlCommand;
    readonly feature: string;
    readonly ins: readonly EmittedIn[];
    readonly outs: readonly EmittedOut[];
    readonly returnPlan: ReturnPlan;
};

const commandJsDoc = ({ command, feature, ins, outs, returnPlan }: CommandJsDocOptions): string => {
    const lines = ["/**", ` * \`${formatPrototype(command)}\``, " *", ` * Provided by \`${feature}\`.`];
    if (ins.length > 0) {
        lines.push(" *");
        for (const slot of ins) lines.push(inParamDocLine(command, slot));
    }
    const returnsLine = returnsDocLine(command, returnPlan, outs);
    if (returnsLine !== undefined) lines.push(returnsLine);
    lines.push(` * @see ${REFPAGES_BASE}/${command.name}.xhtml`);
    lines.push(" */");
    return lines.join("\n");
};

const renderDescriptorList = (descriptors: readonly string[]): string =>
    descriptors.length === 0 ? "[]" : `[${descriptors.join(", ")}]`;

type RenderedCommand = {
    readonly exportName: string;
    readonly binding?: string;
    readonly declaration: string;
};

const returnTsType = (returned: EmittedReturn, outs: readonly EmittedOut[]): string => {
    if (outs.length === 0) return returned.tsType;
    const outTypes = outs.map((out) => out.tsType);
    if (returned.expr === undefined) {
        return outTypes.length === 1 && outTypes[0] !== undefined ? outTypes[0] : `[${outTypes.join(", ")}]`;
    }
    return `[${returned.tsType}, ${outTypes.join(", ")}]`;
};

const returnStatements = (call: string, returned: EmittedReturn, outs: readonly EmittedOut[]): string[] => {
    if (outs.length === 0) {
        return returned.expr === undefined ? [`${call};`] : [`return ${returned.expr(call)};`];
    }
    const outValues = outs.map((out) => `${out.cellName}.value`);
    if (returned.expr === undefined) {
        const tail = outValues.length === 1 ? `return ${outValues[0]};` : `return [${outValues.join(", ")}];`;
        return [`${call};`, tail];
    }
    return [`const result = ${call};`, `return [${returned.expr("result")}, ${outValues.join(", ")}];`];
};

const renderCommand = (
    plan: CommandPlan & { readonly ok: true },
    feature: string,
    usedTypes: Set<string>,
): RenderedCommand => {
    const { command } = plan;
    const exportName = commandExportName(command.name);
    const { slots, ins, outs } = buildSlots(plan, usedTypes);
    const returned = buildEmittedReturn(plan.returnPlan, command.returnGroup, usedTypes);
    const signature = ins.map((slot) => `${slot.name}: ${slot.tsType}`).join(", ");
    const argNames = slots.map((slot) => (slot.out ? slot.cellName : slot.name)).join(", ");
    const descriptors = renderDescriptorList(slots.map((slot) => slot.descriptor));
    const tsReturn = returnTsType(returned, outs);
    const jsDoc = commandJsDoc({ command, feature, ins, outs, returnPlan: plan.returnPlan });
    const seeds = outs.map((out) => out.seed);
    const hasStringOut = plan.params.some((paramPlan) => paramPlan.kind === "string-out");
    if (hasStringOut) {
        const body = [
            ...seeds,
            `const binding = t.fn(LIB, "${command.name}", ${descriptors}, ${returned.descriptor});`,
            ...returnStatements(`binding(${argNames})`, returned, outs),
        ]
            .map((line) => `    ${line}`)
            .join("\n");
        return {
            exportName,
            declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${tsReturn} {\n${body}\n}`,
        };
    }
    const bindingName = command.name;
    const binding = `const ${bindingName} = t.fn(LIB, "${command.name}", ${descriptors}, ${returned.descriptor});`;
    const body = [...seeds, ...returnStatements(`${bindingName}(${argNames})`, returned, outs)]
        .map((line) => `    ${line}`)
        .join("\n");
    return {
        exportName,
        binding,
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${tsReturn} {\n${body}\n}`,
    };
};

type SingularSpec = {
    readonly exportName: string;
    readonly binding?: string;
    readonly declaration: string;
};

const GEN_FAMILY = /^gl(Gen|Create)[A-Z][A-Za-z]*s$/;
const DELETE_FAMILY = /^glDelete[A-Z][A-Za-z]*s$/;

const scalarPrefixSlots = (
    plan: CommandPlan & { readonly ok: true },
    usedTypes: Set<string>,
): EmittedIn[] | undefined => {
    const use = (alias: string): string => {
        usedTypes.add(alias);
        return alias;
    };
    const prefix: EmittedIn[] = [];
    for (let index = 0; index < plan.params.length - 2; index++) {
        const paramPlan = plan.params[index];
        const param = plan.command.params[index];
        if (param === undefined) return undefined;
        if (paramPlan === undefined || (paramPlan.kind !== "scalar" && paramPlan.kind !== "boolean")) return undefined;
        prefix.push(
            buildInSlot(
                { command: plan.command, index, plan: paramPlan, outIndex: 0, usedTypes },
                toIdentifier(param.name),
                use,
            ),
        );
    }
    return prefix;
};

const deriveGenSingular = (
    plan: CommandPlan & { readonly ok: true },
    feature: string,
    usedTypes: Set<string>,
): SingularSpec | undefined => {
    if (!GEN_FAMILY.test(plan.command.name)) return undefined;
    const countIndex = plan.params.length - 2;
    const outIndex = plan.params.length - 1;
    const countPlan = plan.params[countIndex];
    const outPlan = plan.params[outIndex];
    const countParam = plan.command.params[countIndex];
    const outParam = plan.command.params[outIndex];
    if (countPlan?.kind !== "scalar" || outPlan?.kind !== "ref-array-out") return undefined;
    if (countParam === undefined || outParam === undefined) return undefined;
    if (outPlan.lenParamName !== countParam.name || outParam.kind === undefined) return undefined;
    const prefix = scalarPrefixSlots(plan, usedTypes);
    if (prefix === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    const bindingName = `${plan.command.name}Single`;
    const descriptors = [
        ...prefix.map((slot) => slot.descriptor),
        `{ type: ${countPlan.scalar.tExpr} }`,
        `{ type: t.ref(${outPlan.scalar.tExpr}) }`,
    ];
    usedTypes.add(outPlan.scalar.tsAlias);
    const signature = prefix.map((slot) => `${slot.name}: ${slot.tsType}`).join(", ");
    const callArgs = [...prefix.map((slot) => slot.name), "1", "out"].join(", ");
    const jsDoc = [
        "/**",
        ` * Returns one ${outParam.kind} object name via \`${plan.command.name}(${prefix.length > 0 ? "..., " : ""}1, ...)\`.`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ...prefix.map((slot) => inParamDocLine(plan.command, slot)),
        ` * @returns The new ${outParam.kind} object name`,
        ` * @see ${REFPAGES_BASE}/${plan.command.name}.xhtml`,
        " */",
    ].join("\n");
    const body = [`    const out = { value: 0 };`, `    ${bindingName}(${callArgs});`, "    return out.value;"].join(
        "\n",
    );
    return {
        exportName,
        binding: `const ${bindingName} = t.fn(LIB, "${plan.command.name}", ${renderDescriptorList(descriptors)}, t.void);`,
        declaration: `${jsDoc}\nexport function ${exportName}(${signature}): ${outPlan.scalar.tsAlias} {\n${body}\n}`,
    };
};

const deriveDeleteSingular = (
    plan: CommandPlan & { readonly ok: true },
    feature: string,
    usedTypes: Set<string>,
): SingularSpec | undefined => {
    if (!DELETE_FAMILY.test(plan.command.name)) return undefined;
    if (plan.params.length !== 2) return undefined;
    const [countPlan, arrayPlan] = plan.params;
    const [countParam, arrayParam] = plan.command.params;
    if (countPlan?.kind !== "scalar" || arrayPlan?.kind !== "array-in") return undefined;
    if (countParam === undefined || arrayParam === undefined) return undefined;
    if (arrayParam.len !== countParam.name || arrayParam.kind === undefined) return undefined;
    const exportName = singularize(commandExportName(plan.command.name));
    usedTypes.add(arrayPlan.scalar.tsAlias);
    const jsDoc = [
        "/**",
        ` * Deletes one ${arrayParam.kind} object name via \`${plan.command.name}(1, ...)\`.`,
        " *",
        ` * Provided by \`${feature}\`.`,
        ` * @param name - The ${arrayParam.kind} object name to delete`,
        ` * @see ${REFPAGES_BASE}/${plan.command.name}.xhtml`,
        " */",
    ].join("\n");
    return {
        exportName,
        declaration: `${jsDoc}\nexport function ${exportName}(name: ${arrayPlan.scalar.tsAlias}): void {\n    ${plan.command.name}(1, [name]);\n}`,
    };
};

const renderEnumsModule = (
    tokens: readonly { token: GlEnum; exportName: string; literal: string; feature: string }[],
): string => {
    const builder = new ModuleBuilder();
    for (const { token, exportName, literal, feature } of tokens) {
        const groupNote = token.groups.length > 0 ? ` Groups: ${token.groups.map((g) => `\`${g}\``).join(", ")}.` : "";
        builder.appendDeclaration(
            `/** \`${token.name}\` — provided by \`${feature}\`.${groupNote} */\nexport const ${exportName} = ${literal};`,
        );
    }
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const renderTypesModule = (groupAliases: ReadonlyMap<string, string>): string => {
    const builder = new ModuleBuilder();
    builder.appendDeclaration(`/** An opaque \`GLsync\` fence handle. */\nexport type GLsync = object;`);
    builder.appendDeclaration(
        `/** An opaque native pointer handle (e.g. a \`glMapBufferRange\` mapping). */\nexport type GLpointer = object;`,
    );
    const seen = new Set<string>();
    for (const scalar of GL_SCALARS.values()) {
        if (seen.has(scalar.tsAlias)) continue;
        seen.add(scalar.tsAlias);
        builder.appendDeclaration(
            `/** The C \`${scalar.tsAlias}\` scalar. */\nexport type ${scalar.tsAlias} = number;`,
        );
    }
    for (const [group, base] of [...groupAliases.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        builder.appendDeclaration(
            `/** Registry enum group \`${group}\`; open and documentation-only, any \`${base}\` value is accepted. */\nexport type ${group} = ${base};`,
        );
    }
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const TS_PRIMITIVES: ReadonlySet<string> = new Set(["boolean", "string", "void", "number"]);

const renderCommandsModule = (
    rendered: readonly RenderedCommand[],
    singulars: readonly SingularSpec[],
    usedTypes: ReadonlySet<string>,
): string => {
    const builder = new ModuleBuilder();
    builder.imports.addNamed("@gtkx/ffi", "t");
    for (const alias of [...usedTypes].sort((a, b) => a.localeCompare(b))) {
        if (TS_PRIMITIVES.has(alias)) continue;
        builder.imports.addNamed("./types.js", alias, true);
    }
    builder.appendBinding(LIB_CONSTANT);
    for (const command of rendered) {
        if (command.binding !== undefined) builder.appendBinding(command.binding, command.binding);
    }
    for (const singular of singulars) {
        if (singular.binding !== undefined) builder.appendBinding(singular.binding, singular.binding);
    }
    for (const command of rendered) builder.appendDeclaration(command.declaration);
    for (const singular of singulars) builder.appendDeclaration(singular.declaration);
    return `${GENERATED_HEADER}\n\n${builder.toSource()}`;
};

const collectGroupAliases = (plans: readonly (CommandPlan & { readonly ok: true })[]): ReadonlyMap<string, string> => {
    const aliases = new Map<string, string>();
    const consider = (scalar: GlScalar, group: string | undefined): void => {
        if (group === undefined) return;
        if (scalar.tsAlias !== "GLenum" && scalar.tsAlias !== "GLbitfield") return;
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

/** Options for {@link generateGlModules}. */
export type GlGenerationOptions = {
    /** Absolute path to the vendored `gl.xml`. */
    readonly registryPath: string;
    /** Export names of the hand-written companion module, for the disjointness assertion. */
    readonly companionExports: ReadonlySet<string>;
    /** The API/version/profile to generate; defaults to gl 4.6 core. */
    readonly selection?: GlSelection;
};

const DEFAULT_SELECTION: GlSelection = { api: "gl", version: 4.6, profile: "core" };

/**
 * Generates the `@gtkx/gl` source modules from a Khronos registry file.
 *
 * Resolves the selection, plans every selected command, renders the three
 * output modules, validates each through {@link transpileSource}, and asserts
 * that no generated export name collides with the hand-written companion
 * module (an ESM star-export collision drops exports silently).
 *
 * @param options - Registry path, companion export names, and selection
 */
type OkPlan = CommandPlan & { readonly ok: true };

type PlannedSelection = {
    readonly okPlans: readonly OkPlan[];
    readonly planFeatures: ReadonlyMap<string, string>;
    readonly exclusions: readonly GlExclusion[];
};

const planSelectedCommands = (
    registry: ReturnType<typeof loadGlRegistry>,
    commandNames: ReadonlyMap<string, string>,
): PlannedSelection => {
    const exclusions: GlExclusion[] = [];
    const okPlans: OkPlan[] = [];
    const planFeatures = new Map<string, string>();
    for (const [name, feature] of [...commandNames.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const command = registry.commands.get(name);
        if (command === undefined) throw new Error(`Selected command ${name} is not defined in the registry`);
        if (COMPANION_OWNED.has(name)) {
            exclusions.push({ command: name, reason: "companion-owned", detail: "owned by the companion module" });
            continue;
        }
        const plan = planCommand(command, PLAN_POLICY);
        if (!plan.ok) {
            exclusions.push({ command: name, reason: plan.reason, detail: plan.detail });
            continue;
        }
        okPlans.push(plan);
        planFeatures.set(name, feature);
    }
    return { okPlans, planFeatures, exclusions };
};

type EnumRow = {
    readonly token: GlEnum;
    readonly exportName: string;
    readonly literal: string;
    readonly feature: string;
};

type EnumRows = {
    readonly enumRows: readonly EnumRow[];
    readonly skippedEnums: readonly { readonly name: string; readonly reason: string }[];
};

const buildEnumRows = (
    registry: ReturnType<typeof loadGlRegistry>,
    enumNames: ReadonlyMap<string, string>,
    api: string,
): EnumRows => {
    const skippedEnums: { name: string; reason: string }[] = [];
    const enumRows: EnumRow[] = [];
    for (const [name, feature] of [...enumNames.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const token = resolveEnum(registry, name, api);
        const literal = enumLiteral(token);
        if (literal === undefined) {
            skippedEnums.push({ name, reason: `value ${token.value} is outside the safe integer range` });
            continue;
        }
        enumRows.push({ token, exportName: enumExportName(name), literal, feature });
    }
    return { enumRows, skippedEnums };
};

const assertExportNamesDisjoint = (
    rendered: readonly RenderedCommand[],
    singulars: readonly SingularSpec[],
    enumRows: readonly EnumRow[],
    companionExports: ReadonlySet<string>,
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
            `Companion module exports collide with generated exports: ${companionCollisions.sort().join(", ")}`,
        );
    }
};

export const generateGlModules = (options: GlGenerationOptions): GlGenerationResult => {
    const selection = options.selection ?? DEFAULT_SELECTION;
    const registry = loadGlRegistry(options.registryPath);
    const subset = selectSubset(registry, selection);
    const { okPlans, planFeatures, exclusions } = planSelectedCommands(registry, subset.commands);

    const usedTypes = new Set<string>();
    const rendered: RenderedCommand[] = [];
    const singulars: SingularSpec[] = [];
    for (const plan of okPlans) {
        const feature = planFeatures.get(plan.command.name) ?? "unknown feature";
        rendered.push(renderCommand(plan, feature, usedTypes));
        const singular = deriveGenSingular(plan, feature, usedTypes) ?? deriveDeleteSingular(plan, feature, usedTypes);
        if (singular !== undefined) singulars.push(singular);
    }

    const { enumRows, skippedEnums } = buildEnumRows(registry, subset.enums, selection.api);
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
            selectedEnums: subset.enums.size,
            emittedEnums: enumRows.length,
            exclusions,
            skippedEnums,
        },
    };
};
