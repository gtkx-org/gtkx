import type { GlCommand, GlParam } from "./model.js";
import { tScalar } from "../analysis/descriptor.js";

type GlScalar = {
    descriptor: string;
    tsAlias: string;
    viewType?: string;
    isGroupBearing?: boolean;
};

type ParsedCType = {
    base: string;
    pointers: number;
    isConstData: boolean;
};

type ParamPlan =
    | { kind: "scalar"; scalar: GlScalar } |
    { kind: "boolean" } |
    { kind: "sync" } |
    { kind: "string-in" } |
    { kind: "string-array-in" } |
    { kind: "array-in"; scalar: GlScalar } |
    { kind: "ref-out"; scalar: GlScalar } |
    { kind: "ref-array-out"; scalar: GlScalar; lenParamName: string } |
    { kind: "ref-fixed-out"; scalar: GlScalar; length: number } |
    { kind: "string-out"; lenParamName: string } |
    { kind: "buffer" } |
    { kind: "byte-offset" } |
    { kind: "byte-offset-array" };

type ReturnPlan =
    | { kind: "void" } |
    { kind: "scalar"; scalar: GlScalar } |
    { kind: "boolean" } |
    { kind: "string" } |
    { kind: "sync" } |
    { kind: "opaque-pointer" };

type GlExclusionReason =
    | "callback-parameter" |
    "compsize-output" |
    "computed-output-length" |
    "unsupported-shape" |
    "override-owned";

type GlPlanPolicy = {
    byteOffsetParams: Set<string>;
    singleValuedQueries: Set<string>;
};

type CommandPlan =
    | {
        ok: true;
        command: GlCommand;
        params: ParamPlan[];
        returnPlan: ReturnPlan;
    } |
    { ok: false; command: GlCommand; reason: GlExclusionReason };

type ParamOutcome = { plan: ParamPlan } | { reason: GlExclusionReason };

const GL_SCALARS: Map<string, GlScalar> = new Map([
    ["GLenum", { descriptor: tScalar("uint32"), tsAlias: "GLenum", viewType: "Uint32Array", isGroupBearing: true }],
    [
        "GLbitfield",
        { descriptor: tScalar("uint32"), tsAlias: "GLbitfield", viewType: "Uint32Array", isGroupBearing: true },
    ],
    ["GLuint", { descriptor: tScalar("uint32"), tsAlias: "GLuint", viewType: "Uint32Array" }],
    ["GLint", { descriptor: tScalar("int32"), tsAlias: "GLint", viewType: "Int32Array" }],
    ["GLsizei", { descriptor: tScalar("int32"), tsAlias: "GLsizei", viewType: "Int32Array" }],
    ["GLbyte", { descriptor: tScalar("int8"), tsAlias: "GLbyte", viewType: "Int8Array" }],
    ["GLubyte", { descriptor: tScalar("uint8"), tsAlias: "GLubyte", viewType: "Uint8Array" }],
    ["GLshort", { descriptor: tScalar("int16"), tsAlias: "GLshort", viewType: "Int16Array" }],
    ["GLushort", { descriptor: tScalar("uint16"), tsAlias: "GLushort", viewType: "Uint16Array" }],
    ["GLfloat", { descriptor: tScalar("float32"), tsAlias: "GLfloat", viewType: "Float32Array" }],
    ["GLdouble", { descriptor: tScalar("float64"), tsAlias: "GLdouble", viewType: "Float64Array" }],
    ["GLint64", { descriptor: tScalar("int64"), tsAlias: "GLint64" }],
    ["GLuint64", { descriptor: tScalar("uint64"), tsAlias: "GLuint64" }],
    ["GLintptr", { descriptor: tScalar("int64"), tsAlias: "GLintptr" }],
    ["GLsizeiptr", { descriptor: tScalar("int64"), tsAlias: "GLsizeiptr" }],
]);

const GL_BOOLEAN = "GLboolean";
const GL_CHAR = "GLchar";
const GL_SYNC = "GLsync";
const CALLBACK_BASES: Set<string> = new Set(["GLDEBUGPROC", "GLDEBUGPROCARB", "GLDEBUGPROCKHR", "GLVULKANPROCNV"]);

const parseCType = (cType: string): ParsedCType => {
    const pointers = (cType.match(/\*/g) ?? []).length;
    const isConstData = /(^|\s)const(\s|\*)/.test(` ${cType} `) && pointers > 0;

    const base = cType
        .replaceAll("*", " ")
        .split(/\s+/)
        .filter((token) => token.length > 0 && token !== "const" && token !== "struct")
        .join(" ");

    return { base, pointers, isConstData };
};

const isCompsize = (len: string): boolean => len.includes("COMPSIZE(");

const planCompsizeOut = (command: GlCommand, scalar: GlScalar, policy: GlPlanPolicy): ParamOutcome => {
    if (policy.singleValuedQueries.has(command.name)) {
        return { plan: { kind: "ref-out", scalar } };
    }

    return { reason: "compsize-output" };
};

const planPointerOut = (command: GlCommand, param: GlParam, scalar: GlScalar, policy: GlPlanPolicy): ParamOutcome => {
    const len = param.len;

    if (len === undefined || len === "1") {
        return { plan: { kind: "ref-out", scalar } };
    }

    if (isCompsize(len)) {
        return planCompsizeOut(command, scalar, policy);
    }

    if (/^\d+$/.test(len)) {
        return { plan: { kind: "ref-fixed-out", scalar, length: Number(len) } };
    }

    if (command.params.some((other) => other.name === len)) {
        return { plan: { kind: "ref-array-out", scalar, lenParamName: len } };
    }

    return { reason: "computed-output-length" };
};

const planByteOffsetParam = (parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1) {
        return { plan: { kind: "byte-offset" } };
    }

    if (parsed.pointers === 2) {
        return { plan: { kind: "byte-offset-array" } };
    }

    return { reason: "unsupported-shape" };
};

const charStringOutLen = (command: GlCommand, param: GlParam, parsed: ParsedCType): string | undefined => {
    if (parsed.pointers !== 1) {
        return undefined;
    }

    const len = param.len;

    if (len === undefined) {
        return undefined;
    }

    return command.params.some((other) => other.name === len) ? len : undefined;
};

const planCharParam = (command: GlCommand, param: GlParam, parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1 && parsed.isConstData) {
        return { plan: { kind: "string-in" } };
    }

    if (parsed.pointers === 2 && parsed.isConstData) {
        return { plan: { kind: "string-array-in" } };
    }

    const lenParamName = charStringOutLen(command, param, parsed);

    if (lenParamName !== undefined) {
        return { plan: { kind: "string-out", lenParamName } };
    }

    return { reason: "unsupported-shape" };
};

const planScalarParam = (
    command: GlCommand,
    param: GlParam,
    parsed: ParsedCType,
    policy: GlPlanPolicy,
): ParamOutcome => {
    const scalar = GL_SCALARS.get(parsed.base);

    if (scalar === undefined) {
        throw new Error(`Unmapped C base type "${parsed.base}" on ${command.name}(${param.name}: ${param.cType})`);
    }

    if (parsed.pointers === 0) {
        return { plan: { kind: "scalar", scalar } };
    }

    if (parsed.pointers === 1 && parsed.isConstData) {
        return { plan: { kind: "array-in", scalar } };
    }

    if (parsed.pointers === 1) {
        return planPointerOut(command, param, scalar, policy);
    }

    return { reason: "unsupported-shape" };
};

const planVoidParam = (parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1) {
        return { plan: { kind: "buffer" } };
    }

    return { reason: "unsupported-shape" };
};

const planBooleanParam = (parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 0) {
        return { plan: { kind: "boolean" } };
    }

    return { reason: "unsupported-shape" };
};

const planCharOrBoolean = (command: GlCommand, param: GlParam, parsed: ParsedCType): ParamOutcome | undefined => {
    if (parsed.base === GL_CHAR || parsed.base === "GLcharARB") {
        return planCharParam(command, param, parsed);
    }

    if (parsed.base === GL_BOOLEAN) {
        return planBooleanParam(parsed);
    }

    return undefined;
};

const planByBase = (command: GlCommand, param: GlParam, parsed: ParsedCType, policy: GlPlanPolicy): ParamOutcome => {
    const { base, pointers } = parsed;

    if (base === GL_SYNC && pointers === 0) {
        return { plan: { kind: "sync" } };
    }

    if (base === "void") {
        return planVoidParam(parsed);
    }

    return planCharOrBoolean(command, param, parsed) ?? planScalarParam(command, param, parsed, policy);
};

const planParam = (command: GlCommand, param: GlParam, policy: GlPlanPolicy): ParamOutcome => {
    const parsed = parseCType(param.cType);
    const { base } = parsed;

    if (CALLBACK_BASES.has(base) || base.startsWith("_cl_")) {
        return { reason: "callback-parameter" };
    }

    if (policy.byteOffsetParams.has(`${command.name}:${param.name}`)) {
        return planByteOffsetParam(parsed);
    }

    return planByBase(command, param, parsed, policy);
};

const planScalarReturn = (base: string): ReturnPlan | undefined => {
    if (base === "void") {
        return { kind: "void" };
    }

    if (base === GL_SYNC) {
        return { kind: "sync" };
    }

    if (base === GL_BOOLEAN) {
        return { kind: "boolean" };
    }

    const scalar = GL_SCALARS.get(base);

    if (scalar !== undefined) {
        return { kind: "scalar", scalar };
    }

    return undefined;
};

const planPointerReturn = (base: string): ReturnPlan | undefined => {
    if (base === "void") {
        return { kind: "opaque-pointer" };
    }

    if (base === "GLubyte" || base === GL_CHAR) {
        return { kind: "string" };
    }

    return undefined;
};

const planReturn = (command: GlCommand): ReturnPlan => {
    const { base, pointers } = parseCType(command.returnCType);
    let plan: ReturnPlan | undefined;

    if (pointers === 0) {
        plan = planScalarReturn(base);
    } else if (pointers === 1) {
        plan = planPointerReturn(base);
    }

    if (plan !== undefined) {
        return plan;
    }

    throw new Error(`Unmapped return type "${command.returnCType}" on ${command.name}`);
};

const planCommand = (command: GlCommand, policy: GlPlanPolicy): CommandPlan => {
    const params: ParamPlan[] = [];

    for (const param of command.params) {
        const outcome = planParam(command, param, policy);

        if ("reason" in outcome) {
            return { ok: false, command, reason: outcome.reason };
        }

        params.push(outcome.plan);
    }

    return { ok: true, command, params, returnPlan: planReturn(command) };
};

export {
    GL_SCALARS,
    parseCType,
    planCommand,
    type GlScalar,
    type ParsedCType,
    type ParamPlan,
    type ReturnPlan,
    type GlExclusionReason,
    type GlPlanPolicy,
    type CommandPlan,
};
