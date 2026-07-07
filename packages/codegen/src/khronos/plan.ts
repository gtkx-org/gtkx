import { tScalar } from "../analysis/descriptor.js";
import type { GlCommand, GlParam } from "./model.js";

export type GlScalar = {
    descriptor: string;
    tsAlias: string;
    viewType?: string;
    groupBearing?: boolean;
};

export const GL_SCALARS: Map<string, GlScalar> = new Map([
    ["GLenum", { descriptor: tScalar("uint32"), tsAlias: "GLenum", viewType: "Uint32Array", groupBearing: true }],
    [
        "GLbitfield",
        { descriptor: tScalar("uint32"), tsAlias: "GLbitfield", viewType: "Uint32Array", groupBearing: true },
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

export type ParsedCType = {
    base: string;
    pointers: number;
    constData: boolean;
};

export const parseCType = (cType: string): ParsedCType => {
    const pointers = (cType.match(/\*/g) ?? []).length;
    const constData = /(^|\s)const(\s|\*)/.test(` ${cType} `) && pointers > 0;
    const base = cType
        .replaceAll("*", " ")
        .split(/\s+/)
        .filter((token) => token.length > 0 && token !== "const" && token !== "struct")
        .join(" ");
    return { base, pointers, constData };
};

export type ParamPlan =
    | { kind: "scalar"; scalar: GlScalar }
    | { kind: "boolean" }
    | { kind: "sync" }
    | { kind: "string-in" }
    | { kind: "string-array-in" }
    | { kind: "array-in"; scalar: GlScalar }
    | { kind: "ref-out"; scalar: GlScalar }
    | { kind: "ref-array-out"; scalar: GlScalar; lenParamName: string }
    | { kind: "ref-fixed-out"; scalar: GlScalar; length: number }
    | { kind: "string-out"; lenParamName: string }
    | { kind: "buffer" }
    | { kind: "byte-offset" }
    | { kind: "byte-offset-array" };

export type ReturnPlan =
    | { kind: "void" }
    | { kind: "scalar"; scalar: GlScalar }
    | { kind: "boolean" }
    | { kind: "string" }
    | { kind: "sync" }
    | { kind: "opaque-pointer" };

export type GlExclusionReason =
    | "callback-parameter"
    | "compsize-output"
    | "computed-output-length"
    | "unsupported-shape"
    | "companion-owned";

export type GlPlanPolicy = {
    byteOffsetParams: Set<string>;
    singleValuedQueries: Set<string>;
};

export type CommandPlan =
    | {
          ok: true;
          command: GlCommand;
          params: ParamPlan[];
          returnPlan: ReturnPlan;
      }
    | { ok: false; command: GlCommand; reason: GlExclusionReason };

const isCompsize = (len: string): boolean => len.includes("COMPSIZE(");

type ParamOutcome = { plan: ParamPlan } | { reason: GlExclusionReason };

const planPointerOut = (command: GlCommand, param: GlParam, scalar: GlScalar, policy: GlPlanPolicy): ParamOutcome => {
    const len = param.len;
    if (len === undefined || len === "1") return { plan: { kind: "ref-out", scalar } };
    if (isCompsize(len)) {
        if (policy.singleValuedQueries.has(command.name)) return { plan: { kind: "ref-out", scalar } };
        return { reason: "compsize-output" };
    }
    if (/^\d+$/.test(len)) return { plan: { kind: "ref-fixed-out", scalar, length: Number.parseInt(len, 10) } };
    if (command.params.some((other) => other.name === len)) {
        return { plan: { kind: "ref-array-out", scalar, lenParamName: len } };
    }
    return { reason: "computed-output-length" };
};

const planByteOffsetParam = (parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1) return { plan: { kind: "byte-offset" } };
    if (parsed.pointers === 2) return { plan: { kind: "byte-offset-array" } };
    return { reason: "unsupported-shape" };
};

const planCharParam = (command: GlCommand, param: GlParam, parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1 && parsed.constData) return { plan: { kind: "string-in" } };
    if (parsed.pointers === 2 && parsed.constData) return { plan: { kind: "string-array-in" } };
    if (parsed.pointers === 1 && param.len !== undefined && command.params.some((other) => other.name === param.len)) {
        return { plan: { kind: "string-out", lenParamName: param.len } };
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
    if (parsed.pointers === 0) return { plan: { kind: "scalar", scalar } };
    if (parsed.pointers === 1 && parsed.constData) return { plan: { kind: "array-in", scalar } };
    if (parsed.pointers === 1) return planPointerOut(command, param, scalar, policy);
    return { reason: "unsupported-shape" };
};

const planParam = (command: GlCommand, param: GlParam, policy: GlPlanPolicy): ParamOutcome => {
    const parsed = parseCType(param.cType);
    const { base, pointers } = parsed;
    if (CALLBACK_BASES.has(base) || base.startsWith("_cl_")) {
        return { reason: "callback-parameter" };
    }
    if (policy.byteOffsetParams.has(`${command.name}:${param.name}`)) {
        return planByteOffsetParam(parsed);
    }
    if (base === GL_SYNC && pointers === 0) return { plan: { kind: "sync" } };
    if (base === "void") {
        if (pointers === 1) return { plan: { kind: "buffer" } };
        return { reason: "unsupported-shape" };
    }
    if (base === GL_CHAR || base === "GLcharARB") return planCharParam(command, param, parsed);
    if (base === GL_BOOLEAN) {
        if (pointers === 0) return { plan: { kind: "boolean" } };
        return { reason: "unsupported-shape" };
    }
    return planScalarParam(command, param, parsed, policy);
};

const planReturn = (command: GlCommand): ReturnPlan => {
    const { base, pointers } = parseCType(command.returnCType);
    if (base === "void" && pointers === 0) return { kind: "void" };
    if (base === "void" && pointers === 1) return { kind: "opaque-pointer" };
    if (base === GL_SYNC && pointers === 0) return { kind: "sync" };
    if (base === GL_BOOLEAN && pointers === 0) return { kind: "boolean" };
    if ((base === "GLubyte" || base === GL_CHAR) && pointers === 1) return { kind: "string" };
    const scalar = GL_SCALARS.get(base);
    if (scalar !== undefined && pointers === 0) return { kind: "scalar", scalar };
    throw new Error(`Unmapped return type "${command.returnCType}" on ${command.name}`);
};

export const planCommand = (command: GlCommand, policy: GlPlanPolicy): CommandPlan => {
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
