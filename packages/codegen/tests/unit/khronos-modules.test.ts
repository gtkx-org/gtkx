import { describe, expect, it } from "vitest";
import type { GlEnum, GlType } from "../../src/khronos/model.js";
import type { GlSymbolProvenance } from "../../src/khronos/select.js";
import { type EnumRow, renderCommandsModule, renderEnumsModule, renderTypesModule } from "../../src/khronos/modules.js";
import { docContext, glProvenance } from "../helpers/khronos.js";

const REGISTRY_COMMENT = "Copyright 2013-2026 The Khronos Group Inc.\nSPDX-License-Identifier: Apache-2.0";

const glEnum = (overrides: Partial<GlEnum> & { name: string }): GlEnum => ({
    value: "0x8295",
    groups: [],
    isBitmask: false,
    ...overrides,
});

const enumRow = (token: GlEnum, provenance: GlSymbolProvenance = glProvenance()): EnumRow => ({
    token,
    exportName: token.name.slice(3),
    literal: token.value,
    provenance,
});

const glType = (name: string, declaration: string, overrides: Partial<GlType> = {}): GlType => ({
    name,
    declaration,
    ...overrides,
});

const blockFor = (source: string, exported: string): string[] => {
    const lines = source.split("\n");
    const end = lines.indexOf(exported);
    const start = lines.lastIndexOf("/**", end);

    return lines.slice(start, end + 1);
};

const documentedToken = (): GlEnum =>
    glEnum({
        name: "GL_AUTO_GENERATE_MIPMAP",
        groups: ["InternalFormatPName"],
        comment: "Should be deprecated",
        alias: "GL_CLIP_PLANE0",
        valueType: "u",
        vendor: "ARB",
        blockComment: "Tokens whose numeric value is intrinsically meaningful",
    });

const documentedProvenance = (): GlSymbolProvenance =>
    glProvenance({
        feature: "GL_VERSION_4_3",
        requireComment: "Reuse tokens from ARB_internalformat_query2",
        removals: [{ feature: "GL_VERSION_3_2", comment: "Compatibility-only GL 1.1 features removed" }],
    });

describe("khronos enum jsdoc", () => {
    it("emits every registry fact in the documented order", () => {
        const docs = docContext({
            registryComment: REGISTRY_COMMENT,
            extensionEnums: new Map([
                ["GL_AUTO_GENERATE_MIPMAP", [{ name: "GL_ARB_internalformat_query2", notes: ["Extends the query"] }]],
            ]),
        });

        const source = renderEnumsModule([enumRow(documentedToken(), documentedProvenance())], docs);

        expect(blockFor(source, "export const AUTO_GENERATE_MIPMAP = 0x8295;")).toEqual([
            "/**",
            " * `GL_AUTO_GENERATE_MIPMAP`.",
            " *",
            " * Provided by `GL_VERSION_4_3`.",
            " * Removed from the core profile by `GL_VERSION_3_2` (Compatibility-only GL 1.1 features removed), " +
            "then restored by `GL_VERSION_4_3`.",
            " * Registry note: Reuse tokens from ARB_internalformat_query2",
            " * Also provided by the `GL_ARB_internalformat_query2` extension.",
            " * `GL_ARB_internalformat_query2` note: Extends the query.",
            " * Groups: `InternalFormatPName`.",
            " * Token note: Should be deprecated.",
            " * Also known as `GL_CLIP_PLANE0`.",
            " * Tagged `u` in the registry.",
            " * Allocated from the `ARB` enumerant range: Tokens whose numeric value is intrinsically meaningful.",
            " */",
            "export const AUTO_GENERATE_MIPMAP = 0x8295;",
        ]);
    });

    it("emits only the summary and the provided-by line for a bare token", () => {
        const source = renderEnumsModule([enumRow(glEnum({ name: "GL_ONE", value: "1" }))], docContext());

        expect(blockFor(source, "export const ONE = 1;")).toEqual([
            "/**",
            " * `GL_ONE`.",
            " *",
            " * Provided by `GL_VERSION_1_0`.",
            " */",
            "export const ONE = 1;",
        ]);
    });

    it("names the enclosing block when it carries a comment but no vendor", () => {
        const token = glEnum({ name: "GL_DYNAMIC_STORAGE_BIT", value: "0x0100", blockComment: "Reserved bits" });
        const source = renderEnumsModule([enumRow(token)], docContext());

        expect(blockFor(source, "export const DYNAMIC_STORAGE_BIT = 0x0100;")).toContain(
            " * Registry enumerant block: Reserved bits.",
        );
    });
});

describe("khronos enum group aliases", () => {
    const docs = docContext({
        bitmaskGroups: new Set(["ClearBufferMask"]),
        groupMembers: new Map([
            ["ClearBufferMask", ["COLOR_BUFFER_BIT", "DEPTH_BUFFER_BIT"]],
            ["SyncBehaviorFlags", ["NONE"]],
        ]),
    });

    const source = renderTypesModule(
        new Map([
            ["ClearBufferMask", "GLbitfield"],
            ["SyncBehaviorFlags", "GLbitfield"],
        ]),
        docs,
    );

    it("declares a registry bitmask group as combinable and lists its members", () => {
        expect(blockFor(source, "export type ClearBufferMask = GLbitfield;")).toEqual([
            "/**",
            " * Registry enum group `ClearBufferMask`, declared as a bitmask: members are combined with `|`.",
            " *",
            " * Open and documentation-only; any `GLbitfield` value is accepted.",
            " *",
            " * Members: `COLOR_BUFFER_BIT`, `DEPTH_BUFFER_BIT`.",
            " */",
            "export type ClearBufferMask = GLbitfield;",
        ]);
    });

    it("keeps the plain wording for a GLbitfield group the registry does not declare a bitmask", () => {
        expect(blockFor(source, "export type SyncBehaviorFlags = GLbitfield;")).toEqual([
            "/**",
            " * Registry enum group `SyncBehaviorFlags`.",
            " *",
            " * Open and documentation-only; any `GLbitfield` value is accepted.",
            " *",
            " * Members: `NONE`.",
            " */",
            "export type SyncBehaviorFlags = GLbitfield;",
        ]);
    });
});

describe("khronos type aliases", () => {
    const docs = docContext({
        registryComment: REGISTRY_COMMENT,
        types: new Map([
            ["GLenum", glType("GLenum", "typedef unsigned int GLenum;")],
            ["GLbyte", glType("GLbyte", "typedef khronos_int8_t GLbyte;", { requires: "khrplatform" })],
            ["GLsync", glType("GLsync", "typedef struct __GLsync *GLsync;")],
        ]),
    });

    const source = renderTypesModule(new Map(), docs);

    it("prints the registry typedef of a scalar the registry declares", () => {
        expect(source).toContain("/** The C `GLenum` scalar: `typedef unsigned int GLenum;`. */");
    });

    it("names the header a scalar requires", () => {
        expect(source).toContain(
            "/** The C `GLbyte` scalar: `typedef khronos_int8_t GLbyte;`. Requires the `khrplatform` header. */",
        );
    });

    it("falls back to the bare wording for a scalar the registry does not declare", () => {
        expect(source).toContain("/** The C `GLfloat` scalar. */");
    });

    it("prints the registry typedef of the opaque sync handle", () => {
        expect(source).toContain("/** An opaque `GLsync` fence handle: `typedef struct __GLsync *GLsync;`. */");
    });

    it("attributes the generated file to the Khronos registry", () => {
        expect(source.split("\n").slice(0, 8)).toEqual([
            "/**",
            " * GENERATED FILE: do not edit.",
            " *",
            " * Derived from the Khronos OpenGL registry (gl.xml).",
            " *",
            " * Copyright 2013-2026 The Khronos Group Inc.",
            " * SPDX-License-Identifier: Apache-2.0",
            " */",
        ]);
    });
});

describe("khronos commands module", () => {
    it("documents the shared library constant", () => {
        const source = renderCommandsModule([], [], new Set(), docContext());

        expect(source).toContain(
            "/** The shared library the generated OpenGL bindings are loaded from. */\n" +
            "export const LIB = \"libGL.so.1\";",
        );
    });
});
