import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildExtensionIndex } from "../../src/khronos/extensions.js";
import { loadGlRegistry } from "../../src/khronos/model.js";
import { type GlSelection, type GlSymbolProvenance, resolveEnum, selectSubset } from "../../src/khronos/select.js";

const REGISTRY_PATH = fileURLToPath(new URL("../../src/khronos/registry/gl.xml", import.meta.url));
const SELECTION: GlSelection = { api: "gl", version: 4.6, profile: "core" };
const registry = loadGlRegistry(REGISTRY_PATH);
const subset = selectSubset(registry, SELECTION);

const provenanceFor = (source: Map<string, GlSymbolProvenance>, name: string): GlSymbolProvenance => {
    const found = source.get(name);

    if (found === undefined) {
        throw new Error(`No provenance for ${name}`);
    }

    return found;
};

describe("khronos core selection", () => {
    it("restores symbols a later feature re-requires after a core removal", () => {
        const overflow = provenanceFor(subset.enums, "GL_STACK_OVERFLOW");
        expect(overflow.feature).toBe("GL_VERSION_4_3");

        expect(overflow.requireComment).toBe(
            "Restore functionality removed in GL 3.2 core to GL 4.3. Needed for debug interface.",
        );

        expect(overflow.removals).toEqual([
            { feature: "GL_VERSION_3_2", comment: "Compatibility-only GL 1.1 features removed from GL 3.2" },
        ]);

        const quads = provenanceFor(subset.enums, "GL_QUADS");
        expect(quads.feature).toBe("GL_VERSION_4_0");
        expect(quads.requireComment).toBe("Reuse ARB_tessellation_shader");
        const vertexArray = provenanceFor(subset.enums, "GL_VERTEX_ARRAY");
        expect(vertexArray.feature).toBe("GL_VERSION_4_3");
        expect(vertexArray.requireComment).toBe("Reuse tokens from KHR_debug");
        expect(provenanceFor(subset.commands, "glGetPointerv").feature).toBe("GL_VERSION_4_3");
    });

    it("attributes a command to the feature that introduced it", () => {
        const activeTexture = provenanceFor(subset.commands, "glActiveTexture");
        expect(activeTexture.feature).toBe("GL_VERSION_1_3");
        expect(activeTexture.requireComment).toBeUndefined();
        expect(activeTexture.removals).toEqual([]);
    });

    it("records the symbols the core profile drops", () => {
        const begin = subset.removed.find((entry) => entry.name === "glBegin");
        expect(begin?.kind).toBe("command");
        expect(begin?.feature).toBe("GL_VERSION_3_2");
    });
});

describe("khronos extension index", () => {
    it("credits the extensions that also provide a selected symbol", () => {
        const index = buildExtensionIndex(registry, SELECTION);

        expect(index.commands.get("glDebugMessageControl")).toContainEqual(
            expect.objectContaining({ name: "GL_KHR_debug" }),
        );

        expect(index.enums.get("GL_AUTO_GENERATE_MIPMAP")).toContainEqual(
            expect.objectContaining({ name: "GL_ARB_internalformat_query2" }),
        );
    });

    it("sorts every credited extension list", () => {
        const index = buildExtensionIndex(registry, SELECTION);

        expect(index.commands.get("glProgramParameteri")?.map((attribution) => attribution.name)).toEqual([
            "GL_ARB_get_program_binary",
            "GL_ARB_separate_shader_objects",
        ]);
    });

    it("keeps the comment of the extension and of the block that requires the symbol", () => {
        const index = buildExtensionIndex(registry, SELECTION);

        expect(index.commands.get("glBlendColor")).toContainEqual({
            name: "GL_ARB_imaging",
            notes: ["Now treating ARB_imaging as an extension, not a GL API version"],
        });

        expect(index.commands.get("glCreateTextures")).toContainEqual({
            name: "GL_ARB_direct_state_access",
            notes: ["Texture object functions"],
        });
    });
});

describe("khronos enum resolution", () => {
    it("disambiguates a duplicated token by api", () => {
        expect(resolveEnum(registry, "GL_ACTIVE_PROGRAM_EXT", "gl").value).toBe("0x8B8D");
    });
});
