import { describe, expect, it } from "vitest";
import type { InArg, OutArg } from "../../src/khronos/args.js";
import type { GlDocContext } from "../../src/khronos/doc-context.js";
import type { GlExtensionAttribution } from "../../src/khronos/extensions.js";
import type { GlCommand, GlParam } from "../../src/khronos/model.js";
import type { CommandPlan, GlScalar, ParamPlan, ReturnPlan } from "../../src/khronos/plan.js";
import type { GlSymbolProvenance } from "../../src/khronos/select.js";
import { commandJsDoc, derivedJsDoc, inParamDocLine } from "../../src/khronos/jsdoc.js";
import { docContext, glProvenance } from "../helpers/khronos.js";

type OkPlan = CommandPlan & { isOk: true };

const GLENUM: GlScalar = { descriptor: "t.uint32", tsAlias: "GLenum", isGroupBearing: true };
const GLINT: GlScalar = { descriptor: "t.int32", tsAlias: "GLint", viewType: "Int32Array" };
const GLUINT: GlScalar = { descriptor: "t.uint32", tsAlias: "GLuint", viewType: "Uint32Array" };
const GLFLOAT: GlScalar = { descriptor: "t.float32", tsAlias: "GLfloat", viewType: "Float32Array" };
const GLSIZEI: GlScalar = { descriptor: "t.int32", tsAlias: "GLsizei", viewType: "Int32Array" };
const SCALAR_RETURN: ReturnPlan = { kind: "scalar", scalar: GLENUM };
const VOID_RETURN: ReturnPlan = { kind: "void" };

const KIND_TABLE: Map<string, string> = new Map([
    ["Color", "This parameter represents part of or a complete color."],
    ["Matrix4x4", "This parameter represents a 4x4 matrix."],
    ["Clamped[0; 1]", "This parameter will get clamped to the 0 to 1 range."],
]);

const glCommand = (overrides: Partial<GlCommand> & { name: string }): GlCommand => ({
    returnCType: "void",
    returnKinds: [],
    params: [],
    ...overrides,
});

const glParam = (overrides: Partial<GlParam> & { name: string; cType: string }): GlParam => ({
    kinds: [],
    ...overrides,
});

const extension = (name: string, notes: string[] = []): GlExtensionAttribution => ({ name, notes });

const okPlan = (command: GlCommand, params: ParamPlan[], returnPlan: ReturnPlan = VOID_RETURN): OkPlan => ({
    isOk: true,
    command,
    params,
    returnPlan,
});

const inArg = (name: string, tsType: string): InArg => ({ isOut: false, name, tsType, descriptor: "t.float32" });

const outArg = (paramIndex: number, tsType: string): OutArg => ({
    isOut: true,
    cellName: `out${String(paramIndex)}`,
    seed: "",
    tsType,
    descriptor: "t.ref(t.int32)",
    paramIndex,
});

const lineStartingWith = (doc: string, prefix: string): string[] =>
    doc.split("\n").filter((line) => line.startsWith(prefix));

const noteDoc = (command: GlCommand, provenance: GlSymbolProvenance, docs: GlDocContext): string =>
    commandJsDoc({ plan: okPlan(command, []), provenance, ins: [], outs: [], docs });

const notedCommand = (): GlCommand =>
    glCommand({
        name: "glVertexAttrib1d",
        comment: "Kept for the tessellation shaders",
        vecEquiv: "glVertexAttrib1dv",
        glx: { type: "render", opcode: "197", comment: "PBO protocol" },
    });

describe("khronos command jsdoc", () => {
    it("separates the prose block from the tag block on a parameterless command", () => {
        const doc = commandJsDoc({
            plan: okPlan(
                glCommand({ name: "glGetError", returnCType: "GLenum", returnGroup: "ErrorCode" }),
                [],
                SCALAR_RETURN,
            ),
            provenance: glProvenance(),
            ins: [],
            outs: [],
            docs: docContext(),
        });

        expect(doc).toBe(
            [
                "/**",
                " * `GLenum glGetError()`",
                " *",
                " * Provided by `GL_VERSION_1_0`.",
                " *",
                " * @returns `ErrorCode`",
                " */",
            ].join("\n"),
        );
    });
});

describe("khronos derived singular jsdoc", () => {
    it("separates the prose block from the tag block on a derived singular", () => {
        const doc = derivedJsDoc({
            command: glCommand({ name: "glGenBuffers" }),
            provenance: glProvenance({ feature: "GL_VERSION_1_5" }),
            summary: "Returns one buffer object name via `glGenBuffers(1, ...)`.",
            body: [" * @returns `GLuint`, object class `buffer`"],
            docs: docContext(),
        });

        expect(doc).toBe(
            [
                "/**",
                " * Returns one buffer object name via `glGenBuffers(1, ...)`.",
                " *",
                " * Provided by `GL_VERSION_1_5`.",
                " *",
                " * @returns `GLuint`, object class `buffer`",
                " */",
            ].join("\n"),
        );
    });

    it("keeps the notes of the parent command off a derived singular", () => {
        const doc = derivedJsDoc({
            command: notedCommand(),
            provenance: glProvenance(),
            summary: "Deletes one buffer object name via `glVertexAttrib1d(1, ...)`.",
            body: [],
            docs: docContext({
                aliasTargets: new Map([["glVertexAttrib1d", ["glVertexAttrib1dARB"]]]),
                emittedCommands: new Set(["glVertexAttrib1dv"]),
            }),
        });

        expect(doc).not.toContain("Also known as");
        expect(doc).not.toContain("GLX render opcode");
        expect(doc).not.toContain("Vector form");
    });
});

describe("khronos parameter metadata", () => {
    const command = glCommand({
        name: "glParams",
        params: [
            glParam({ name: "red", cType: "GLfloat", kinds: ["Color"] }),
            glParam({ name: "value", cType: "const GLfloat *", len: "count*16", kinds: ["Matrix4x4"] }),
            glParam({ name: "path", cType: "GLuint", kinds: ["Path"] }),
            glParam({ name: "depth", cType: "GLdouble", kinds: ["Clamped[0; 1]", "Color"] }),
        ],
    });

    const plan = okPlan(command, [
        { kind: "scalar", scalar: GLFLOAT },
        { kind: "array-in", scalar: GLFLOAT },
        { kind: "scalar", scalar: GLUINT },
        { kind: "scalar", scalar: GLFLOAT },
    ]);

    const doc = commandJsDoc({
        plan,
        provenance: glProvenance(),
        ins: [
            inArg("red", "GLfloat"),
            inArg("value", "GLfloat[] | Float32Array"),
            inArg("path", "GLuint"),
            inArg("depth", "GLdouble"),
        ],
        outs: [],
        docs: docContext({ kinds: KIND_TABLE }),
    });

    it("appends the description of a kind the registry table knows", () => {
        expect(lineStartingWith(doc, " * @param red")).toEqual([
            " * @param red - `GLfloat`, kind `Color`. This parameter represents part of or a complete color.",
        ]);

        expect(lineStartingWith(doc, " * @param value")).toEqual([
            " * @param value - `GLfloat[] | Float32Array`, length `count*16`, kind `Matrix4x4`. " +
            "This parameter represents a 4x4 matrix.",
        ]);
    });

    it("omits the sentence for a kind the registry table lacks", () => {
        expect(lineStartingWith(doc, " * @param path")).toEqual([" * @param path - `GLuint`, kind `Path`"]);
    });

    it("lists a comma-joined kind as one entry per kind", () => {
        expect(lineStartingWith(doc, " * @param depth")).toEqual([
            " * @param depth - `GLdouble`, kind `Clamped[0; 1]`, kind `Color`. " +
            "This parameter will get clamped to the 0 to 1 range. " +
            "This parameter represents part of or a complete color.",
        ]);
    });
});

describe("khronos parameter shapes", () => {
    it("documents a byte-offset parameter as an offset, without its C pointer length", () => {
        const command = glCommand({
            name: "glDrawElements",
            params: [glParam({ name: "indices", cType: "const void *", len: "COMPSIZE(count,type)" })],
        });

        const plan = okPlan(command, [{ kind: "byte-offset" }]);
        const arg = inArg("indices", "GLintptr");

        expect(inParamDocLine(plan, arg, docContext())).toBe(
            " * @param indices - `GLintptr`, byte offset into the bound buffer",
        );
    });

    it("drops the group once the emitted type already names it", () => {
        const command = glCommand({
            name: "glTexImage2D",
            params: [
                glParam({ name: "target", cType: "GLenum", group: "TextureTarget" }),
                glParam({ name: "internalformat", cType: "GLint", group: "InternalFormat" }),
            ],
        });

        const plan = okPlan(command, [
            { kind: "scalar", scalar: GLENUM },
            { kind: "scalar", scalar: GLINT },
        ]);

        expect(inParamDocLine(plan, inArg("target", "TextureTarget"), docContext())).toBe(
            " * @param target - `TextureTarget`",
        );

        expect(inParamDocLine(plan, inArg("internalformat", "GLint"), docContext())).toBe(
            " * @param internalformat - `GLint`, group `InternalFormat`",
        );
    });
});

describe("khronos return metadata", () => {
    it("reports the emitted type of a pointer return, with its registry metadata", () => {
        const doc = commandJsDoc({
            plan: okPlan(
                glCommand({
                    name: "glGetString",
                    returnCType: "const GLubyte *",
                    returnObjectClass: "program",
                    returnKinds: ["String"],
                }),
                [],
                { kind: "string" },
            ),
            provenance: glProvenance(),
            ins: [],
            outs: [],
            docs: docContext(),
        });

        expect(lineStartingWith(doc, " * @returns")).toEqual([
            " * @returns `string`, object class `program`, kind `String`",
        ]);
    });

    it("reports a GLboolean return as the emitted boolean", () => {
        const doc = commandJsDoc({
            plan: okPlan(glCommand({ name: "glIsBuffer", returnCType: "GLboolean" }), [], { kind: "boolean" }),
            provenance: glProvenance(),
            ins: [],
            outs: [],
            docs: docContext(),
        });

        expect(lineStartingWith(doc, " * @returns")).toEqual([" * @returns `boolean`"]);
    });
});

describe("khronos out parameter metadata", () => {
    it("reports a collapsed single-valued query as the scalar it returns", () => {
        const command = glCommand({
            name: "glGetShaderiv",
            params: [
                glParam({ name: "shader", cType: "GLuint", objectClass: "shader" }),
                glParam({ name: "pname", cType: "GLenum", group: "ShaderParameterName" }),
                glParam({ name: "params", cType: "GLint *", len: "COMPSIZE(pname)" }),
            ],
        });

        const doc = commandJsDoc({
            plan: okPlan(command, [
                { kind: "scalar", scalar: GLUINT },
                { kind: "scalar", scalar: GLENUM },
                { kind: "ref-out", scalar: GLINT },
            ]),
            provenance: glProvenance(),
            ins: [inArg("shader", "GLuint"), inArg("pname", "ShaderParameterName")],
            outs: [outArg(2, "GLint")],
            docs: docContext(),
        });

        expect(lineStartingWith(doc, " * @returns")).toEqual([" * @returns `params` (`GLint`)"]);
    });

    it("keeps the length of an out parameter the caller still sizes", () => {
        const command = glCommand({
            name: "glGenBuffers",
            params: [
                glParam({ name: "n", cType: "GLsizei" }),
                glParam({ name: "buffers", cType: "GLuint *", len: "n", objectClass: "buffer" }),
            ],
        });

        const doc = commandJsDoc({
            plan: okPlan(command, [
                { kind: "scalar", scalar: GLSIZEI },
                { kind: "ref-array-out", scalar: GLUINT, lenParamName: "n" },
            ]),
            provenance: glProvenance(),
            ins: [inArg("n", "GLsizei")],
            outs: [outArg(1, "GLuint[]")],
            docs: docContext(),
        });

        expect(lineStartingWith(doc, " * @returns")).toEqual([
            " * @returns `buffers` (`GLuint[]`, length `n`, object class `buffer`)",
        ]);
    });
});

describe("khronos tuple returns", () => {
    it("prints every out member of a tuple return", () => {
        const command = glCommand({
            name: "glGetError",
            params: [
                glParam({ name: "length", cType: "GLsizei *", len: "1" }),
                glParam({ name: "type", cType: "GLenum *", group: "AttributeType", len: "1" }),
            ],
        });

        const doc = commandJsDoc({
            plan: okPlan(command, [
                { kind: "ref-out", scalar: GLSIZEI },
                { kind: "ref-out", scalar: GLENUM },
            ]),
            provenance: glProvenance(),
            ins: [],
            outs: [outArg(0, "GLsizei"), outArg(1, "AttributeType")],
            docs: docContext(),
        });

        expect(lineStartingWith(doc, " * @returns")).toEqual([
            " * @returns Tuple of `length` (`GLsizei`), `type` (`AttributeType`)",
        ]);
    });
});

describe("khronos registry provenance notes", () => {
    const provenance = glProvenance({
        feature: "GL_VERSION_4_3",
        requireComment: "Reuse tokens from KHR_debug",
        removals: [
            { feature: "GL_VERSION_3_2", comment: "Compatibility-only GL 1.1 features removed from GL 3.2" },
            { feature: "GL_VERSION_4_0" },
        ],
    });

    const docs = docContext({
        aliasTargets: new Map([["glVertexAttrib1d", ["glVertexAttrib1dARB", "glVertexAttrib1dNV"]]]),

        extensionCommands: new Map([
            ["glVertexAttrib1d", [extension("GL_ARB_vertex_program"), extension("GL_NV_vertex_program")]],
        ]),

        emittedCommands: new Set(["glVertexAttrib1dv"]),
    });

    it("emits every note once, in the documented order", () => {
        const doc = noteDoc(notedCommand(), provenance, docs);

        expect(doc.split("\n").slice(3, 11)).toEqual([
            " * Provided by `GL_VERSION_4_3`.",
            " * Removed from the core profile by `GL_VERSION_3_2` " +
            "(Compatibility-only GL 1.1 features removed from GL 3.2), `GL_VERSION_4_0`, " +
            "then restored by `GL_VERSION_4_3`.",
            " * Registry note: Reuse tokens from KHR_debug",
            " * Also provided by the `GL_ARB_vertex_program`, `GL_NV_vertex_program` extensions.",
            " * Registry note: Kept for the tessellation shaders",
            " * Also known as `glVertexAttrib1dARB`, `glVertexAttrib1dNV`.",
            " * Vector form: `vertexAttrib1dv`.",
            " * GLX render opcode 197. PBO protocol.",
        ]);

        expect(lineStartingWith(doc, " * Registry note:")).toEqual([
            " * Registry note: Reuse tokens from KHR_debug",
            " * Registry note: Kept for the tessellation shaders",
        ]);
    });
});

describe("khronos extension notes", () => {
    it("quotes the note each providing extension carries", () => {
        const withNotes = docContext({
            extensionCommands: new Map([
                [
                    "glActiveTexture",
                    [
                        extension("GL_ARB_imaging", ["Now treating ARB_imaging as an extension, not a GL API version"]),
                        extension("GL_ARB_multitexture", ["Texture object functions"]),
                    ],
                ],
            ]),
        });

        const doc = noteDoc(glCommand({ name: "glActiveTexture" }), glProvenance(), withNotes);

        expect(lineStartingWith(doc, " * `GL_ARB")).toEqual([
            " * `GL_ARB_imaging` note: Now treating ARB_imaging as an extension, not a GL API version.",
            " * `GL_ARB_multitexture` note: Texture object functions.",
        ]);
    });
});

describe("khronos registry note omission", () => {
    it("omits every note the registry does not carry, and the empty tag block with them", () => {
        const doc = noteDoc(glCommand({ name: "glVertexAttrib1d" }), glProvenance(), docContext());
        expect(doc.split("\n").slice(3)).toEqual([" * Provided by `GL_VERSION_1_0`.", " */"]);
    });

    it("names a single extension in the singular", () => {
        const extensions = new Map([["glActiveTexture", [extension("GL_ARB_multitexture")]]]);
        const docs = docContext({ extensionCommands: extensions });
        const doc = noteDoc(glCommand({ name: "glActiveTexture" }), glProvenance(), docs);

        expect(lineStartingWith(doc, " * Also provided by")).toEqual([
            " * Also provided by the `GL_ARB_multitexture` extension.",
        ]);
    });

    it("drops the vector form when its target is not emitted", () => {
        const docs = docContext({ emittedCommands: new Set(["glVertexAttrib1d"]) });
        const doc = noteDoc(notedCommand(), glProvenance(), docs);
        expect(lineStartingWith(doc, " * Vector form:")).toEqual([]);
    });
});
