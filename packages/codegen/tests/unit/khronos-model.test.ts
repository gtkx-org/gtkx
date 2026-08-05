import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type GlEnum, type GlFeature, loadGlRegistry } from "../../src/khronos/model.js";

const REGISTRY_PATH = fileURLToPath(new URL("../../src/khronos/registry/gl.xml", import.meta.url));
const registry = loadGlRegistry(REGISTRY_PATH);

const enumNamed = (name: string): GlEnum => {
    const found = registry.enums.find((candidate) => candidate.name === name);

    if (found === undefined) {
        throw new Error(`No enum named ${name} in the registry`);
    }

    return found;
};

const featureNamed = (name: string): GlFeature => {
    const found = registry.features.find((candidate) => candidate.name === name);

    if (found === undefined) {
        throw new Error(`No feature named ${name} in the registry`);
    }

    return found;
};

describe("khronos registry kinds", () => {
    it("retains every declared parameter kind description", () => {
        expect(registry.kinds.size).toBe(29);
        expect(registry.kinds.get("WinCoord")).toBe("This parameter represents a window coordinate.");
    });
});

describe("khronos registry types", () => {
    it("keeps the declaration text with the type name inline", () => {
        expect(registry.types.get("GLenum")?.declaration).toBe("typedef unsigned int GLenum;");
    });

    it("keeps the requires and comment attributes", () => {
        expect(registry.types.get("GLbyte")?.requires).toBe("khrplatform");
        expect(registry.types.get("GLvoid")?.comment).toBe("Not an actual GL type, though used in headers in the past");
    });

    it("retains every declared type", () => {
        expect(registry.types.size).toBe(43);
    });
});

describe("khronos registry commands", () => {
    it("splits parameter kinds", () => {
        expect(registry.commands.get("glClearColor")?.params[0]?.kinds).toEqual(["Color"]);
    });

    it("keeps the return object class and kinds", () => {
        expect(registry.commands.get("glCreateProgram")?.returnObjectClass).toBe("program");
        expect(registry.commands.get("glGetString")?.returnKinds).toEqual(["String"]);
    });

    it("keeps the vector equivalent and glx protocol information", () => {
        expect(registry.commands.get("glVertexAttrib1d")?.vecEquiv).toBe("glVertexAttrib1dv");
        expect(registry.commands.get("glActiveTexture")?.glx).toEqual({ type: "render", opcode: "197" });
    });

    it("keeps the command's own glx entry, not the named protocol variant", () => {
        expect(registry.commands.get("glTexImage2D")?.glx).toEqual({ type: "render", opcode: "110" });
        expect(registry.commands.get("glReadPixels")?.glx).toEqual({ type: "single", opcode: "111" });
    });

    it("inverts the alias relation onto the aliased command", () => {
        expect(registry.commands.get("glActiveTextureARB")?.aliasTarget).toBe("glActiveTexture");
        expect(registry.aliasTargets.get("glActiveTexture")).toContain("glActiveTextureARB");
    });
});

describe("khronos registry enums", () => {
    it("records bitmask groups only where the block declares them", () => {
        expect(registry.bitmaskGroups.has("ClearBufferMask")).toBe(true);
        expect(registry.bitmaskGroups.has("SyncBehaviorFlags")).toBe(false);
    });

    it("keeps the value type, comment, and enclosing vendor", () => {
        const token = enumNamed("GL_INVALID_INDEX");
        expect(token.valueType).toBe("u");
        expect(token.comment).toBe("Tagged as uint");
        expect(token.vendor).toBe("ARB");
    });

    it("keeps enum aliases and deprecation comments", () => {
        expect(enumNamed("GL_CLIP_DISTANCE0").alias).toBe("GL_CLIP_PLANE0");
        expect(enumNamed("GL_AUTO_GENERATE_MIPMAP").comment).toBe("Should be deprecated");
    });

    it("inherits the bitmask flag from the enclosing block", () => {
        expect(enumNamed("GL_COLOR_BUFFER_BIT").isBitmask).toBe(true);
    });
});

describe("khronos registry extensions", () => {
    it("retains every extension and splits its supported apis", () => {
        expect(registry.extensions).toHaveLength(863);
        const multitexture = registry.extensions.find((extension) => extension.name === "GL_ARB_multitexture");
        expect(multitexture?.supported).toContain("gl");
    });
});

describe("khronos registry comment", () => {
    it("keeps the license header", () => {
        expect(registry.comment).toContain("SPDX-License-Identifier: Apache-2.0");
    });
});

describe("khronos registry features", () => {
    it("keeps require and remove blocks interleaved in document order", () => {
        const comments = featureNamed("GL_VERSION_4_3")
            .blocks.filter((block) => block.kind === "require")
            .map((block) => block.comment);

        expect(comments).toContain(
            "Restore functionality removed in GL 3.2 core to GL 4.3. Needed for debug interface.",
        );

        const removals = featureNamed("GL_VERSION_3_2")
            .blocks.filter((block) => block.kind === "remove")
            .map((block) => block.comment);

        expect(removals).toContain("Compatibility-only GL 1.1 features removed from GL 3.2");
    });
});
