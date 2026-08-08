import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGlRegistry } from "../../../src/khronos/model.js";
import { generateGlModules, type GlGenerationResult } from "../../../src/khronos/pipeline.js";
import { selectSubset } from "../../../src/khronos/select.js";

const REGISTRY_PATH = fileURLToPath(new URL("../../../src/khronos/registry/gl.xml", import.meta.url));

const OVERRIDE_EXPORTS: Set<string> = new Set([
    "getShaderInfoLog",
    "getProgramInfoLog",
    "getProgramPipelineInfoLog",
    "DebugMessageCallback",
    "debugMessageCallback",
    "clientWaitSyncLoop",
]);

const result: GlGenerationResult = generateGlModules({
    registryPath: REGISTRY_PATH,
    overrideExports: OVERRIDE_EXPORTS,
});

const COMMANDS_SOURCE = result.files.get("commands.ts") ?? "";
const ENUMS_SOURCE = result.files.get("enums.ts") ?? "";
const TYPES_SOURCE = result.files.get("types.ts") ?? "";

const DRAW_ELEMENTS_SIGNATURE =
    /drawElements\(\s*mode: PrimitiveType,\s*count: GLsizei,\s*type: DrawElementsType,\s*indices: GLintptr,?\s*\)/;

const getDocBlock = (source: string, declaration: string): string => {
    const declarationIndex = source.indexOf(declaration);
    expect(declarationIndex).toBeGreaterThan(-1);

    return source.slice(source.lastIndexOf("/**", declarationIndex), declarationIndex);
};

describe("khronos selection over the vendored registry", () => {
    it("resolves the gl 4.6 core subset to the pinned counts", () => {
        const registry = loadGlRegistry(REGISTRY_PATH);
        const subset = selectSubset(registry, { api: "gl", version: 4.6, profile: "core" });
        expect(subset.commands.size).toBe(657);
        expect(subset.enums.size).toBe(1367);
    });

    it("declares the gl feature range from 1.0 to 4.6", () => {
        const registry = loadGlRegistry(REGISTRY_PATH);
        const numbers = registry.features.filter((feature) => feature.api === "gl").map((feature) => feature.number);
        expect(Math.min(...numbers)).toBe(1);
        expect(Math.max(...numbers)).toBeCloseTo(4.6, 10);
    });
});

describe("khronos generation counts", () => {
    it("emits the pinned command and enum counts", () => {
        expect(result.report.selectedCommands).toBe(657);
        expect(result.report.emittedCommands).toBe(612);
        expect(result.report.derivedSingulars).toBe(27);
        expect(result.report.exclusions).toHaveLength(45);
    });

    it("skips the unsafe-integer timeout token", () => {
        expect(result.files.get("enums.ts")).not.toContain("TIMEOUT_IGNORED");
    });

    it("reports the skipped enum token instead of dropping it silently", () => {
        expect(result.report.enumExclusions).toContain("GL_TIMEOUT_IGNORED");
        expect(ENUMS_SOURCE).not.toContain("TIMEOUT_IGNORED");
    });

    it("records the symbols the core profile removed", () => {
        expect(result.report.coreRemovals.length).toBeGreaterThan(0);

        expect(result.report.coreRemovals).toContainEqual(
            expect.objectContaining({ name: "glBegin", kind: "command" }),
        );
    });

    it("excludes the debug callback and override-owned commands", () => {
        const byName = new Map(result.report.exclusions.map((exclusion) => [exclusion.command, exclusion.reason]));
        expect(byName.get("glDebugMessageCallback")).toBe("callback-parameter");
        expect(byName.get("glGetShaderInfoLog")).toBe("override-owned");
        expect(byName.get("glGetIntegerv")).toBe("compsize-output");
        expect(byName.get("glGetPointerv")).toBe("unsupported-shape");
    });
});

describe("khronos generation surface", () => {
    it("emits prefix-stripped typed wrappers", () => {
        expect(COMMANDS_SOURCE).toContain(
            "export function clearColor(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void",
        );

        expect(COMMANDS_SOURCE).toContain("export function createShader(type: ShaderType): GLuint");
        expect(COMMANDS_SOURCE).toContain("return glCreateShader(type) as GLuint;");
    });

    it("types curated byte-offset parameters as numbers, never views", () => {
        expect(COMMANDS_SOURCE).toContain("pointer: GLintptr");
        expect(COMMANDS_SOURCE).toMatch(DRAW_ELEMENTS_SIGNATURE);
    });

    it("passes data parameters as buffers accepting views, offsets, and null", () => {
        expect(COMMANDS_SOURCE).toContain("data: ArrayBufferView | GLintptr | null");
    });

    it("returns out-parameters instead of taking cells", () => {
        expect(COMMANDS_SOURCE).toContain("export function genBuffers(n: GLsizei): GLuint[]");
        expect(COMMANDS_SOURCE).toContain("const out0 = { value: new Array<number>(n).fill(0) };");

        expect(COMMANDS_SOURCE).toContain(
            "export function getShaderiv(shader: GLuint, pname: ShaderParameterName): GLint",
        );

        expect(COMMANDS_SOURCE).toContain(
            "export function getShaderSource(shader: GLuint, bufSize: GLsizei): [GLsizei, string]",
        );
    });

    it("keeps tokens the core profile removed and a later feature restored", () => {
        expect(ENUMS_SOURCE).toContain("export const STACK_OVERFLOW = 0x0503;");
        expect(ENUMS_SOURCE).toContain("export const STACK_UNDERFLOW = 0x0504;");
        expect(ENUMS_SOURCE).toContain("export const QUADS = 0x0007;");
        expect(ENUMS_SOURCE).toContain("export const VERTEX_ARRAY = 0x8074;");
    });

    it("omits the commands whose pointer shape cannot be marshalled", () => {
        expect(COMMANDS_SOURCE).not.toContain("export function getPointerv");
    });

    it("derives singular forms from the gen/create/delete families", () => {
        expect(COMMANDS_SOURCE).toContain("export function genBuffer(): GLuint");
        expect(COMMANDS_SOURCE).toContain("export function createQuery(target: QueryTarget): GLuint");
        expect(COMMANDS_SOURCE).toContain("export function deleteVertexArray(name: GLuint): void");
    });
});

describe("khronos generation guarantees", () => {
    it("emits open enum-group aliases and constants", () => {
        const types = result.files.get("types.ts") ?? "";
        expect(types).toContain("export type ShaderType = GLenum;");
        expect(types).toContain("export type ClearBufferMask = GLbitfield;");
        const enums = result.files.get("enums.ts") ?? "";
        expect(enums).toContain("export const COLOR_BUFFER_BIT = 0x00004000;");
        expect(enums).toContain("export const VERTEX_SHADER = 0x8b31;");
    });

    it("rejects override exports that collide with generated names", () => {
        expect(() =>
            generateGlModules({ registryPath: REGISTRY_PATH, overrideExports: new Set(["clearColor"]) }),
        ).toThrow(/Override module exports collide/);
    });
});

describe("khronos generated documentation", () => {
    it("documents parameters with their registry kind and description", () => {
        const block = getDocBlock(COMMANDS_SOURCE, "export function clearColor(");

        expect(block).toContain(
            " * @param red - `GLfloat`, kind `Color`. This parameter represents part of or a complete color.",
        );
    });

    it("documents return values with the emitted type, group and object class", () => {
        expect(getDocBlock(COMMANDS_SOURCE, "export function getError(")).toContain(" * @returns `ErrorCode`");

        expect(getDocBlock(COMMANDS_SOURCE, "export function createProgram(")).toContain(
            " * @returns `GLuint`, object class `program`",
        );

        expect(getDocBlock(COMMANDS_SOURCE, "export function isBuffer(")).toContain(" * @returns `boolean`");
        expect(getDocBlock(COMMANDS_SOURCE, "export function getString(")).toContain(" * @returns `string`");
        expect(getDocBlock(COMMANDS_SOURCE, "export function mapBuffer(")).toContain(" * @returns `GLpointer`");
    });

    it("documents a collapsed single-valued query as the scalar it returns", () => {
        const block = getDocBlock(COMMANDS_SOURCE, "export function getShaderiv(");
        expect(block).toContain(" * @returns `params` (`GLint`)");
        expect(block).not.toContain("COMPSIZE");
    });

    it("documents a byte-offset parameter as an offset into the bound buffer", () => {
        const block = getDocBlock(COMMANDS_SOURCE, "export function drawElements(");
        expect(block).toContain(" * @param indices - `GLintptr`, byte offset into the bound buffer");
        expect(block).not.toContain("COMPSIZE");
    });

    it("documents aliases, vector forms, and GLX opcodes", () => {
        const activeTexture = getDocBlock(COMMANDS_SOURCE, "export function activeTexture(");
        expect(activeTexture).toContain(" * Also known as `glActiveTextureARB`.");
        expect(activeTexture).toContain(" * GLX render opcode 197.");

        expect(getDocBlock(COMMANDS_SOURCE, "export function vertexAttrib1d(")).toContain(
            " * Vector form: `vertexAttrib1dv`.",
        );
    });
});

describe("khronos generated provenance", () => {
    it("documents the command's own GLX opcode, not the one of a named protocol variant", () => {
        expect(getDocBlock(COMMANDS_SOURCE, "export function texImage2D(")).toContain(" * GLX render opcode 110.");
        expect(getDocBlock(COMMANDS_SOURCE, "export function readPixels(")).toContain(" * GLX single opcode 111.");
    });

    it("keeps the notes of the parent command off a derived singular", () => {
        const block = getDocBlock(COMMANDS_SOURCE, "export function genBuffer(");
        expect(block).toContain(" * Provided by `GL_VERSION_1_5`.");
        expect(block).not.toContain("Also known as");
        expect(block).not.toContain("GLX ");
    });

    it("quotes the registry comment of a providing extension and of its require block", () => {
        expect(getDocBlock(COMMANDS_SOURCE, "export function blendColor(")).toContain(
            " * `GL_ARB_imaging` note: Now treating ARB_imaging as an extension, not a GL API version.",
        );

        expect(getDocBlock(COMMANDS_SOURCE, "export function createTextures(")).toContain(
            " * `GL_ARB_direct_state_access` note: Texture object functions.",
        );
    });

    it("documents the registry alone, without linking out to the refpages", () => {
        expect(COMMANDS_SOURCE).not.toContain("@see");
        expect(COMMANDS_SOURCE).not.toContain("OpenGL-Refpages");
    });

    it("closes the block after the prose when a command has no tags", () => {
        expect(getDocBlock(COMMANDS_SOURCE, "export function finish(")).not.toContain(" *\n */");
    });
});

describe("khronos generated enum documentation", () => {
    it("documents the removal history of a restored token", () => {
        expect(getDocBlock(ENUMS_SOURCE, "export const STACK_OVERFLOW")).toContain(
            " * Removed from the core profile by `GL_VERSION_3_2` " +
            "(Compatibility-only GL 1.1 features removed from GL 3.2), then restored by `GL_VERSION_4_3`.",
        );
    });

    it("documents group members and bitmask combination", () => {
        const clearBufferMask = getDocBlock(TYPES_SOURCE, "export type ClearBufferMask");
        expect(clearBufferMask).toContain(" * Members: `COLOR_BUFFER_BIT`,");
        expect(clearBufferMask).toContain("combined with `|`");
        expect(getDocBlock(TYPES_SOURCE, "export type SyncBehaviorFlags")).not.toContain("combined with `|`");
    });

    it("documents scalar aliases with their C typedef", () => {
        expect(getDocBlock(TYPES_SOURCE, "export type GLenum")).toContain("typedef unsigned int GLenum;");
    });

    it("documents the shared library constant", () => {
        expect(COMMANDS_SOURCE).toContain(
            "/** The shared library the generated OpenGL bindings are loaded from. */\nexport const LIB",
        );
    });

    it("carries the registry license header in every module", () => {
        expect(COMMANDS_SOURCE).toContain("SPDX-License-Identifier: Apache-2.0");
        expect(ENUMS_SOURCE).toContain("SPDX-License-Identifier: Apache-2.0");
        expect(TYPES_SOURCE).toContain("SPDX-License-Identifier: Apache-2.0");
    });
});
