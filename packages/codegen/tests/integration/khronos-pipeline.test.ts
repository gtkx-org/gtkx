import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadGlRegistry } from "../../src/khronos/model.js";
import { type GlGenerationResult, generateGlModules } from "../../src/khronos/pipeline.js";
import { resolveEnum, selectSubset } from "../../src/khronos/select.js";

const REGISTRY_PATH = fileURLToPath(new URL("../../registry/gl.xml", import.meta.url));

const COMPANION_EXPORTS: ReadonlySet<string> = new Set([
    "getShaderInfoLog",
    "getProgramInfoLog",
    "getProgramPipelineInfoLog",
    "DebugMessageCallback",
    "debugMessageCallback",
    "clientWaitSyncLoop",
]);

describe("khronos selection over the vendored registry", () => {
    it("resolves the gl 4.6 core subset to the pinned counts", () => {
        const registry = loadGlRegistry(REGISTRY_PATH);
        const subset = selectSubset(registry, { api: "gl", version: 4.6, profile: "core" });
        expect(subset.commands.size).toBe(656);
        expect(subset.enums.size).toBe(1363);
    });

    it("declares the gl feature range from 1.0 to 4.6", () => {
        const registry = loadGlRegistry(REGISTRY_PATH);
        const numbers = registry.features.filter((feature) => feature.api === "gl").map((feature) => feature.number);
        expect(Math.min(...numbers)).toBe(1.0);
        expect(Math.max(...numbers)).toBe(4.6);
    });

    it("keys API-overloaded enum tokens by API", () => {
        const registry = loadGlRegistry(REGISTRY_PATH);
        const forGl = resolveEnum(registry, "GL_ACTIVE_PROGRAM_EXT", "gl");
        const forGles = resolveEnum(registry, "GL_ACTIVE_PROGRAM_EXT", "gles2");
        expect(forGl.value).not.toBe(forGles.value);
    });
});

let result: GlGenerationResult;

beforeAll(() => {
    result = generateGlModules({ registryPath: REGISTRY_PATH, companionExports: COMPANION_EXPORTS });
});

describe("khronos generation counts", () => {
    it("emits the pinned command and enum counts", () => {
        expect(result.report.selectedCommands).toBe(656);
        expect(result.report.emittedCommands).toBe(612);
        expect(result.report.derivedSingulars).toBe(27);
        expect(result.report.selectedEnums).toBe(1363);
        expect(result.report.emittedEnums).toBe(1362);
        expect(result.report.exclusions).toHaveLength(44);
    });

    it("skips only the unsafe-integer timeout token", () => {
        expect(result.report.skippedEnums).toEqual([
            { name: "GL_TIMEOUT_IGNORED", reason: "value 0xFFFFFFFFFFFFFFFF is outside the safe integer range" },
        ]);
        expect(result.files.get("enums.ts")).not.toContain("TIMEOUT_IGNORED");
    });

    it("excludes the debug callback and companion-owned commands", () => {
        const byName = new Map(result.report.exclusions.map((exclusion) => [exclusion.command, exclusion.reason]));
        expect(byName.get("glDebugMessageCallback")).toBe("callback-parameter");
        expect(byName.get("glGetShaderInfoLog")).toBe("companion-owned");
        expect(byName.get("glGetIntegerv")).toBe("compsize-output");
    });
});

describe("khronos generation surface", () => {
    it("emits prefix-stripped typed wrappers", () => {
        const commands = result.files.get("commands.ts") ?? "";
        expect(commands).toContain(
            "export function clearColor(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void",
        );
        expect(commands).toContain("export function createShader(type: ShaderType): GLuint");
        expect(commands).toContain("return glCreateShader(type) as GLuint;");
    });

    it("types curated byte-offset parameters as numbers, never views", () => {
        const commands = result.files.get("commands.ts") ?? "";
        expect(commands).toContain("pointer: GLintptr");
        expect(commands).toMatch(
            /drawElements\(\s*mode: PrimitiveType,\s*count: GLsizei,\s*type: DrawElementsType,\s*indices: GLintptr,?\s*\)/,
        );
    });

    it("passes data parameters as blobs accepting views, offsets, and null", () => {
        const commands = result.files.get("commands.ts") ?? "";
        expect(commands).toContain("data: ArrayBufferView | GLintptr | null");
    });

    it("returns out-parameters instead of taking cells", () => {
        const commands = result.files.get("commands.ts") ?? "";
        expect(commands).toContain("export function genBuffers(n: GLsizei): GLuint[]");
        expect(commands).toContain("const out0 = { value: new Array<number>(n).fill(0) };");
        expect(commands).toContain("export function getShaderiv(shader: GLuint, pname: ShaderParameterName): GLint");
        expect(commands).toContain(
            "export function getShaderSource(shader: GLuint, bufSize: GLsizei): [GLsizei, string]",
        );
    });

    it("derives singular forms from the gen/create/delete families", () => {
        const commands = result.files.get("commands.ts") ?? "";
        expect(commands).toContain("export function genBuffer(): GLuint");
        expect(commands).toContain("export function createQuery(target: QueryTarget): GLuint");
        expect(commands).toContain("export function deleteVertexArray(name: GLuint): void");
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

    it("rejects companion exports that collide with generated names", () => {
        expect(() =>
            generateGlModules({ registryPath: REGISTRY_PATH, companionExports: new Set(["clearColor"]) }),
        ).toThrow(/Companion module exports collide/);
    });
});
