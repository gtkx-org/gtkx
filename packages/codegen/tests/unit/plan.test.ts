import { describe, expect, it } from "vitest";
import type { GlCommand, GlParam } from "../../src/khronos/model.js";
import { type CommandPlan, type GlPlanPolicy, parseCType, planCommand } from "../../src/khronos/plan.js";

const NO_POLICY: GlPlanPolicy = { byteOffsetParams: new Set(), singleValuedQueries: new Set() };

const command = (name: string, returnCType: string, params: GlParam[]): GlCommand => ({
    name,
    returnCType,
    params,
});

const param = (name: string, cType: string, extra?: Partial<GlParam>): GlParam => ({ name, cType, ...extra });

const okPlan = (input: GlCommand, policy: GlPlanPolicy = NO_POLICY): CommandPlan & { ok: true } => {
    const plan = planCommand(input, policy);
    if (!plan.ok) throw new Error(`Expected ${input.name} to plan, got exclusion: ${plan.reason}`);
    return plan;
};

describe("parseCType", () => {
    it("parses a plain scalar", () => {
        expect(parseCType("GLenum")).toEqual({ base: "GLenum", pointers: 0, constData: false });
    });

    it("parses a const data pointer", () => {
        expect(parseCType("const GLfloat *")).toEqual({ base: "GLfloat", pointers: 1, constData: true });
    });

    it("parses a mutable output pointer", () => {
        expect(parseCType("GLuint *")).toEqual({ base: "GLuint", pointers: 1, constData: false });
    });

    it("parses a const string array", () => {
        expect(parseCType("const GLchar *const*")).toEqual({ base: "GLchar", pointers: 2, constData: true });
    });

    it("parses void pointers", () => {
        expect(parseCType("const void *")).toEqual({ base: "void", pointers: 1, constData: true });
        expect(parseCType("void *")).toEqual({ base: "void", pointers: 1, constData: false });
    });

    it("strips struct tags from foreign handles", () => {
        expect(parseCType("struct _cl_context *")).toEqual({ base: "_cl_context", pointers: 1, constData: false });
    });
});

describe("planCommand", () => {
    it("plans scalars, input arrays, and buffers", () => {
        const plan = okPlan(
            command("glBufferData", "void", [
                param("target", "GLenum", { group: "BufferTargetARB" }),
                param("size", "GLsizeiptr"),
                param("data", "const void *", { len: "size" }),
                param("usage", "GLenum", { group: "BufferUsageARB" }),
            ]),
        );
        expect(plan.params.map((p) => p.kind)).toEqual(["scalar", "scalar", "buffer", "scalar"]);
        expect(plan.returnPlan).toEqual({ kind: "void" });
    });

    it("plans string arrays and input length arrays", () => {
        const plan = okPlan(
            command("glShaderSource", "void", [
                param("shader", "GLuint", { objectClass: "shader" }),
                param("count", "GLsizei"),
                param("string", "const GLchar *const*", { len: "count" }),
                param("length", "const GLint *", { len: "count" }),
            ]),
        );
        expect(plan.params.map((p) => p.kind)).toEqual(["scalar", "scalar", "string-array-in", "array-in"]);
    });

    it("routes curated byte-offset parameters away from buffer typing", () => {
        const policy: GlPlanPolicy = {
            byteOffsetParams: new Set(["glDrawElements:indices"]),
            singleValuedQueries: new Set(),
        };
        const plan = okPlan(
            command("glDrawElements", "void", [
                param("mode", "GLenum", { group: "PrimitiveType" }),
                param("count", "GLsizei"),
                param("type", "GLenum", { group: "DrawElementsType" }),
                param("indices", "const void *", { len: "count" }),
            ]),
            policy,
        );
        expect(plan.params[3]).toEqual({ kind: "byte-offset" });
    });
});

describe("planCommand outputs", () => {
    it("excludes COMPSIZE outputs unless the command is a single-valued query", () => {
        const query = command("glGetShaderiv", "void", [
            param("shader", "GLuint", { objectClass: "shader" }),
            param("pname", "GLenum", { group: "ShaderParameterName" }),
            param("params", "GLint *", { len: "COMPSIZE(pname)" }),
        ]);
        const excluded = planCommand(query, NO_POLICY);
        expect(excluded.ok).toBe(false);
        if (excluded.ok) return;
        expect(excluded.reason).toBe("compsize-output");

        const carvedOut = okPlan(query, {
            byteOffsetParams: new Set(),
            singleValuedQueries: new Set(["glGetShaderiv"]),
        });
        expect(carvedOut.params[2]?.kind).toBe("ref-out");
    });

    it("plans sized and fixed output arrays", () => {
        const plan = okPlan(
            command("glGenBuffers", "void", [
                param("n", "GLsizei"),
                param("buffers", "GLuint *", { len: "n", objectClass: "buffer" }),
            ]),
        );
        expect(plan.params[1]).toMatchObject({ kind: "ref-array-out", lenParamName: "n" });

        const fixed = okPlan(
            command("glGetVertexAttribfv", "void", [
                param("index", "GLuint"),
                param("pname", "GLenum"),
                param("params", "GLfloat *", { len: "4" }),
            ]),
        );
        expect(fixed.params[2]).toMatchObject({ kind: "ref-fixed-out", length: 4 });
    });
});

describe("planCommand exclusions", () => {
    it("excludes computed output lengths and callback parameters", () => {
        const computed = planCommand(
            command("glGetnUniformfv", "void", [
                param("program", "GLuint"),
                param("location", "GLint"),
                param("bufSize", "GLsizei"),
                param("params", "GLfloat *", { len: "bufSize / 4" }),
            ]),
            NO_POLICY,
        );
        expect(computed.ok).toBe(false);
        if (computed.ok) return;
        expect(computed.reason).toBe("computed-output-length");

        const callback = planCommand(
            command("glDebugMessageCallback", "void", [
                param("callback", "GLDEBUGPROC"),
                param("userParam", "const void *"),
            ]),
            NO_POLICY,
        );
        expect(callback.ok).toBe(false);
        if (callback.ok) return;
        expect(callback.reason).toBe("callback-parameter");
    });

    it("plans character outputs sized by a sibling parameter", () => {
        const plan = okPlan(
            command("glGetShaderSource", "void", [
                param("shader", "GLuint", { objectClass: "shader" }),
                param("bufSize", "GLsizei"),
                param("length", "GLsizei *", { len: "1" }),
                param("source", "GLchar *", { len: "bufSize" }),
            ]),
        );
        expect(plan.params.map((p) => p.kind)).toEqual(["scalar", "scalar", "ref-out", "string-out"]);
    });
});

describe("planCommand returns", () => {
    it("plans sync handles, boolean wrapping, and string returns", () => {
        const sync = okPlan(
            command("glFenceSync", "GLsync", [param("condition", "GLenum"), param("flags", "GLbitfield")]),
        );
        expect(sync.returnPlan).toEqual({ kind: "sync" });

        const isBuffer = okPlan(command("glIsBuffer", "GLboolean", [param("buffer", "GLuint")]));
        expect(isBuffer.returnPlan).toEqual({ kind: "boolean" });

        const getString = okPlan(command("glGetString", "const GLubyte *", [param("name", "GLenum")]));
        expect(getString.returnPlan).toEqual({ kind: "string" });
    });

    it("throws on a base type outside the closed table", () => {
        expect(() => planCommand(command("glMystery", "void", [param("widget", "GLwidget")]), NO_POLICY)).toThrow(
            /Unmapped C base type "GLwidget"/,
        );
    });
});
