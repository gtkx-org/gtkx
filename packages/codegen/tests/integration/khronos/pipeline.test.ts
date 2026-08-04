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

const DRAW_ELEMENTS_SIGNATURE =
    /drawElements\(\s*mode: PrimitiveType,\s*count: GLsizei,\s*type: DrawElementsType,\s*indices: GLintptr,?\s*\)/;

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
        expect(Math.min(...numbers)).toBe(1);
        expect(Math.max(...numbers)).toBeCloseTo(4.6, 10);
    });
});

describe("khronos generation counts", () => {
    it("emits the pinned command and enum counts", () => {
        expect(result.report.selectedCommands).toBe(656);
        expect(result.report.emittedCommands).toBe(612);
        expect(result.report.derivedSingulars).toBe(27);
        expect(result.report.exclusions).toHaveLength(44);
    });

    it("skips the unsafe-integer timeout token", () => {
        expect(result.files.get("enums.ts")).not.toContain("TIMEOUT_IGNORED");
    });

    it("excludes the debug callback and override-owned commands", () => {
        const byName = new Map(result.report.exclusions.map((exclusion) => [exclusion.command, exclusion.reason]));
        expect(byName.get("glDebugMessageCallback")).toBe("callback-parameter");
        expect(byName.get("glGetShaderInfoLog")).toBe("override-owned");
        expect(byName.get("glGetIntegerv")).toBe("compsize-output");
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
