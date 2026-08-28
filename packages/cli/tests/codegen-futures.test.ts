import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, removeCliProject, runCli } from "./cli-project.js";
import {
    asyncPairConfig,
    BYTE_SEQUENCE_CASES,
    byteSeqConfig,
    FINISH_RESULT_CASES,
    generatedModule,
    INOUT_RETURN_CASES,
    inoutBoxConfig,
    isStoreMarked,
    markStore,
    VALUE_PARAMETER_BINDINGS,
    VALUE_PARAMETER_DECLARATIONS,
    VALUE_RETURN_CASES,
    valueBoxConfig,
} from "./codegen-helpers.js";

describe("gtkx codegen (byte sequence representation)", () => {
    it.each(BYTE_SEQUENCE_CASES)("$title", ({ v2ByteArrays, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-bytes-",
            config: byteSeqConfig(v2ByteArrays),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "byteseq", "byteseq.d.ts");
            const emittedBindings = generatedModule(project, "gi", "byteseq", "byteseq.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the byte sequence setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-bytes-flip-",
            config: byteSeqConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), byteSeqConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "byteseq", "byteseq.d.ts")).toContain("readSized(): number[]");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (values a binding takes and hands back)", () => {
    it("takes a JavaScript value wherever a GValue is expected", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-values-",
            config: valueBoxConfig(undefined),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "valuebox", "valuebox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "valuebox", "valuebox.js");
            expect(VALUE_PARAMETER_DECLARATIONS.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(VALUE_PARAMETER_BINDINGS.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it.each(VALUE_RETURN_CASES)("$title", ({ v2ValueReturns, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-value-returns-",
            config: valueBoxConfig(v2ValueReturns),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "valuebox", "valuebox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "valuebox", "valuebox.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the value return setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-value-returns-flip-",
            config: valueBoxConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), valueBoxConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "valuebox", "valuebox.d.ts")).toContain("peek(): GObject.Value");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (promisified finish results)", () => {
    it.each(FINISH_RESULT_CASES)("$title", ({ v2FinishResults, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-finish-results-",
            config: asyncPairConfig(v2FinishResults),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "asyncpair", "asyncpair.d.ts");
            const emittedBindings = generatedModule(project, "gi", "asyncpair", "asyncpair.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (inout records a binding mutates in place)", () => {
    it.each(INOUT_RETURN_CASES)("$title", ({ v2InoutReturns, declarations, bindings }) => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-inout-returns-",
            config: inoutBoxConfig(v2InoutReturns),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            const emitted = generatedModule(project, "gi", "inoutbox", "inoutbox.d.ts");
            const emittedBindings = generatedModule(project, "gi", "inoutbox", "inoutbox.js");
            expect(declarations.filter((text) => !emitted.includes(text))).toEqual([]);
            expect(bindings.filter((text) => !emittedBindings.includes(text))).toEqual([]);
        } finally {
            removeCliProject(project);
        }
    });

    it("regenerates a fresh store when the inout return setting changes", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-inout-returns-flip-",
            config: inoutBoxConfig(true),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            markStore(project);
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(true);
            writeFileSync(join(project.root, "gtkx.config.ts"), inoutBoxConfig(undefined));
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(isStoreMarked(project)).toBe(false);
            expect(generatedModule(project, "gi", "inoutbox", "inoutbox.d.ts")).toContain("recenter(spot: Spot): Spot");
        } finally {
            removeCliProject(project);
        }
    });
});
