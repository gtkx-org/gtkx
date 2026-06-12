import type { GlCommand, GlParam } from "./model.js";

/** One row of the closed GL scalar table. */
export type GlScalar = {
    /** The `t.*` descriptor expression (e.g. `t.uint32`). */
    readonly tExpr: string;
    /** The TypeScript alias emitted for the C type (e.g. `GLenum`). */
    readonly tsAlias: string;
    /** The TypedArray accepted alongside `number[]` for array parameters. */
    readonly viewType?: string;
};

/**
 * The closed C scalar type → FFI descriptor table. A selected command using a
 * base type outside this table (and outside the string/void/sync special
 * cases) is a hard generation error, never a silent skip.
 */
export const GL_SCALARS: ReadonlyMap<string, GlScalar> = new Map([
    ["GLenum", { tExpr: "t.uint32", tsAlias: "GLenum", viewType: "Uint32Array" }],
    ["GLbitfield", { tExpr: "t.uint32", tsAlias: "GLbitfield", viewType: "Uint32Array" }],
    ["GLuint", { tExpr: "t.uint32", tsAlias: "GLuint", viewType: "Uint32Array" }],
    ["GLint", { tExpr: "t.int32", tsAlias: "GLint", viewType: "Int32Array" }],
    ["GLsizei", { tExpr: "t.int32", tsAlias: "GLsizei", viewType: "Int32Array" }],
    ["GLbyte", { tExpr: "t.int8", tsAlias: "GLbyte", viewType: "Int8Array" }],
    ["GLubyte", { tExpr: "t.uint8", tsAlias: "GLubyte", viewType: "Uint8Array" }],
    ["GLshort", { tExpr: "t.int16", tsAlias: "GLshort", viewType: "Int16Array" }],
    ["GLushort", { tExpr: "t.uint16", tsAlias: "GLushort", viewType: "Uint16Array" }],
    ["GLfixed", { tExpr: "t.int32", tsAlias: "GLfixed", viewType: "Int32Array" }],
    ["GLclampx", { tExpr: "t.int32", tsAlias: "GLclampx", viewType: "Int32Array" }],
    ["GLfloat", { tExpr: "t.float32", tsAlias: "GLfloat", viewType: "Float32Array" }],
    ["GLclampf", { tExpr: "t.float32", tsAlias: "GLclampf", viewType: "Float32Array" }],
    ["GLdouble", { tExpr: "t.float64", tsAlias: "GLdouble", viewType: "Float64Array" }],
    ["GLclampd", { tExpr: "t.float64", tsAlias: "GLclampd", viewType: "Float64Array" }],
    ["GLint64", { tExpr: "t.int64", tsAlias: "GLint64" }],
    ["GLuint64", { tExpr: "t.uint64", tsAlias: "GLuint64" }],
    ["GLintptr", { tExpr: "t.int64", tsAlias: "GLintptr" }],
    ["GLsizeiptr", { tExpr: "t.int64", tsAlias: "GLsizeiptr" }],
]);

const GL_BOOLEAN = "GLboolean";
const GL_CHAR = "GLchar";
const GL_SYNC = "GLsync";
const CALLBACK_BASES: ReadonlySet<string> = new Set([
    "GLDEBUGPROC",
    "GLDEBUGPROCARB",
    "GLDEBUGPROCKHR",
    "GLVULKANPROCNV",
]);

/** A parsed C parameter or return type: base name, indirection, constness. */
export type ParsedCType = {
    /** The base type name (e.g. `GLfloat`, `void`, `GLchar`). */
    readonly base: string;
    /** Pointer depth (0 for values). */
    readonly pointers: number;
    /** Whether the pointee data is `const` (an input pointer). */
    readonly constData: boolean;
};

/**
 * Parses a registry C type string into its base name, pointer depth, and
 * data constness.
 *
 * @param cType - The normalized C type text (e.g. `const GLchar *const*`)
 */
export const parseCType = (cType: string): ParsedCType => {
    const pointers = (cType.match(/\*/g) ?? []).length;
    const constData = /(^|\s)const(\s|\*)/.test(` ${cType} `) && pointers > 0;
    const base = cType
        .replace(/\*/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 0 && token !== "const" && token !== "struct")
        .join(" ");
    return { base, pointers, constData };
};

/** How one parameter crosses the FFI boundary and surfaces in TypeScript. */
export type ParamPlan =
    | { readonly kind: "scalar"; readonly scalar: GlScalar }
    | { readonly kind: "boolean" }
    | { readonly kind: "sync" }
    | { readonly kind: "string-in" }
    | { readonly kind: "string-array-in" }
    | { readonly kind: "array-in"; readonly scalar: GlScalar }
    | { readonly kind: "ref-out"; readonly scalar: GlScalar }
    | { readonly kind: "ref-array-out"; readonly scalar: GlScalar; readonly lenParamName: string }
    | { readonly kind: "ref-fixed-out"; readonly scalar: GlScalar; readonly length: number }
    | { readonly kind: "string-out"; readonly lenParamName: string }
    | { readonly kind: "blob" }
    | { readonly kind: "byte-offset" }
    | { readonly kind: "byte-offset-array" };

/** How a return value crosses the FFI boundary and surfaces in TypeScript. */
export type ReturnPlan =
    | { readonly kind: "void" }
    | { readonly kind: "scalar"; readonly scalar: GlScalar }
    | { readonly kind: "boolean" }
    | { readonly kind: "string" }
    | { readonly kind: "sync" }
    | { readonly kind: "opaque-pointer" };

/** Why a selected command is excluded from generation. */
export type GlExclusionReason =
    | "callback-parameter"
    | "compsize-output"
    | "computed-output-length"
    | "unsupported-shape"
    | "companion-owned";

/** Curated policy tables steering parameter classification. */
export type GlPlanPolicy = {
    /**
     * `command:param` keys whose `void *` argument is a byte offset into a
     * bound buffer object, never client memory.
     */
    readonly byteOffsetParams: ReadonlySet<string>;
    /**
     * Commands whose `COMPSIZE(pname)`-sized output is single-valued for
     * every legal `pname`, generated with a scalar out-cell.
     */
    readonly singleValuedQueries: ReadonlySet<string>;
};

/** The outcome of planning one command: a full plan or an exclusion. */
export type CommandPlan =
    | {
          readonly ok: true;
          readonly command: GlCommand;
          readonly params: readonly ParamPlan[];
          readonly returnPlan: ReturnPlan;
      }
    | { readonly ok: false; readonly command: GlCommand; readonly reason: GlExclusionReason; readonly detail: string };

const isCompsize = (len: string): boolean => len.includes("COMPSIZE(");

const paramExclusion = (
    param: GlParam,
    reason: GlExclusionReason,
    why: string,
): { reason: GlExclusionReason; detail: string } => ({
    reason,
    detail: `${param.name} (${param.cType}): ${why}`,
});

type ParamOutcome = { plan: ParamPlan } | { reason: GlExclusionReason; detail: string };

const planPointerOut = (command: GlCommand, param: GlParam, scalar: GlScalar, policy: GlPlanPolicy): ParamOutcome => {
    const len = param.len;
    if (len === undefined || len === "1") return { plan: { kind: "ref-out", scalar } };
    if (isCompsize(len)) {
        if (policy.singleValuedQueries.has(command.name)) return { plan: { kind: "ref-out", scalar } };
        return paramExclusion(param, "compsize-output", `output sized by ${len}`);
    }
    if (/^\d+$/.test(len)) return { plan: { kind: "ref-fixed-out", scalar, length: Number.parseInt(len, 10) } };
    if (command.params.some((other) => other.name === len)) {
        return { plan: { kind: "ref-array-out", scalar, lenParamName: len } };
    }
    return paramExclusion(param, "computed-output-length", `output sized by expression "${len}"`);
};

const planByteOffsetParam = (param: GlParam, parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1) return { plan: { kind: "byte-offset" } };
    if (parsed.pointers === 2) return { plan: { kind: "byte-offset-array" } };
    return paramExclusion(param, "unsupported-shape", "byte-offset entry with unexpected indirection");
};

const planCharParam = (command: GlCommand, param: GlParam, parsed: ParsedCType): ParamOutcome => {
    if (parsed.pointers === 1 && parsed.constData) return { plan: { kind: "string-in" } };
    if (parsed.pointers === 2 && parsed.constData) return { plan: { kind: "string-array-in" } };
    if (parsed.pointers === 1 && param.len !== undefined && command.params.some((other) => other.name === param.len)) {
        return { plan: { kind: "string-out", lenParamName: param.len } };
    }
    return paramExclusion(param, "unsupported-shape", "character output without a sizing parameter");
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
    return paramExclusion(param, "unsupported-shape", "multi-level scalar pointer");
};

const planParam = (command: GlCommand, param: GlParam, policy: GlPlanPolicy): ParamOutcome => {
    const parsed = parseCType(param.cType);
    const { base, pointers } = parsed;
    if (CALLBACK_BASES.has(base) || base.startsWith("_cl_")) {
        return paramExclusion(param, "callback-parameter", "callback or foreign handle parameter");
    }
    if (policy.byteOffsetParams.has(`${command.name}:${param.name}`)) {
        return planByteOffsetParam(param, parsed);
    }
    if (base === GL_SYNC && pointers === 0) return { plan: { kind: "sync" } };
    if (base === "void") {
        if (pointers === 1) return { plan: { kind: "blob" } };
        return paramExclusion(param, "unsupported-shape", "multi-level void pointer");
    }
    if (base === GL_CHAR || base === "GLcharARB") return planCharParam(command, param, parsed);
    if (base === GL_BOOLEAN) {
        if (pointers === 0) return { plan: { kind: "boolean" } };
        return paramExclusion(param, "unsupported-shape", "GLboolean pointer parameter");
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

/**
 * Plans how a selected command crosses the FFI boundary: one {@link ParamPlan}
 * per parameter plus a {@link ReturnPlan}, or an exclusion carrying the first
 * parameter that cannot be expressed. Shapes outside the closed table throw —
 * an unmapped base type is a generator bug or a registry reshape, never a
 * silent skip.
 *
 * @param command - The registry command to plan
 * @param policy - The curated byte-offset and single-valued-query tables
 */
export const planCommand = (command: GlCommand, policy: GlPlanPolicy): CommandPlan => {
    const params: ParamPlan[] = [];
    for (const param of command.params) {
        const outcome = planParam(command, param, policy);
        if ("reason" in outcome) {
            return { ok: false, command, reason: outcome.reason, detail: outcome.detail };
        }
        params.push(outcome.plan);
    }
    return { ok: true, command, params, returnPlan: planReturn(command) };
};
