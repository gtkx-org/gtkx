import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";
import {
    ARRAY_WRITES,
    AXES_EMISSION,
    classBody,
    COMMENT,
    CORNER_READ,
    CORNER_WRITE,
    DOCUMENTED_MODULE_CASES,
    fixtureConfig,
    generatedModule,
    HOVER_CASES,
    HOVER_PROBE,
    hoverDoc,
    INLINE_ARRAY_ACCESSORS,
    INLINE_ARRAY_FIELDS,
    INLINE_ELEMENT_DESCRIPTORS,
    LENGTH_BOUNDED_READ,
    OMITTED_ARRAY_FIELDS,
    OMITTED_FIELD_CASES,
    omittedMentions,
    POINTER_ARRAY_FIELDS,
    POINTER_ARRAY_GETTER,
    RECORD_FIELD_ACCESSORS,
} from "./codegen-helpers.js";

describe("gtkx codegen (libraries the generated types have to escape)", () => {
    it("binds a class whose static narrows the one it inherits", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-statics-",
            config: fixtureConfig("StaticNarrow-1.0"),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(generatedModule(project, "gi", "staticnarrow", "staticnarrow.d.ts")).toContain("StaticBase<");
        } finally {
            removeCliProject(project);
        }
    });

    it("binds a type whose GIR name starts with a digit", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-codegen-digit-",
            config: fixtureConfig("DigitName-1.0"),
        });

        try {
            expect(runCli(project, ["codegen"]).status).toBe(0);
            expect(generatedModule(project, "gi", "digitname", "digitname.d.ts")).toContain("enum _80211Mode");
        } finally {
            removeCliProject(project);
        }
    });
});

describe("gtkx codegen (where the documentation goes)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-",
            config: fixtureConfig("Documented-1.0"),
            files: { "src/probe.tsx": HOVER_PROBE },
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it.each(DOCUMENTED_MODULE_CASES)("documents $title in its declaration alone", ({ store, stem, docs }) => {
        expect(state.status).toBe(0);
        const declared = generatedModule(state.project, store, `${stem}.d.ts`);
        expect(docs.filter((text) => !declared.includes(text))).toEqual([]);
        expect(generatedModule(state.project, store, `${stem}.js`)).not.toMatch(COMMENT);
    });

    it.each(HOVER_CASES)("surfaces the documentation of $title on hover", ({ text, doc }) => {
        expect(state.status).toBe(0);
        expect(hoverDoc(state.project, join("src", "probe.tsx"), text)).toContain(doc);
    });
});

describe("gtkx codegen (record fields and the GType a type registers)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "recordfields", "recordfields.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "recordfields", "recordfields.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-fields-",
            config: fixtureConfig("RecordFields-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("reads a null-terminated array field through an accessor", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Node");
        expect(RECORD_FIELD_ACCESSORS.filter((text) => !declared.includes(text))).toEqual([]);
        const bound = classBody(bindings(), "Node");
        expect(bound).toMatch(/get interfaces\(\) \{\s+return fromNative\(\w+, read\(getHandle\(this\), \w+, 8\)\);/);
    });

    it("stores no array field, through an accessor or through the constructor", () => {
        expect(state.status).toBe(0);
        const emitted = `${declarations()}${bindings()}`;
        expect(ARRAY_WRITES.filter((text) => emitted.includes(text))).toEqual([]);
        expect(declarations()).toContain("refCount?:");
    });

    it.each(OMITTED_FIELD_CASES)("declares no member for $title", ({ jsName }) => {
        expect(state.status).toBe(0);
        const emitted = `${classBody(declarations(), "Node")}${classBody(bindings(), "Node")}`;
        expect(emitted).toContain("get interfaces(): Iface[];");
        expect(omittedMentions(emitted, jsName)).toEqual([]);
        expect(declarations()).not.toContain(`${jsName}?:`);
    });

    it("tags an interface that registers a GType", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Provider");
        expect(declared).toContain("class Provider ");
        expect(declared).toContain("__type__");
    });

    it("leaves a record that registers no GType without one", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Plain");
        expect(declared).toContain("class Plain ");
        expect(declared).not.toContain("__type__");
    });
});

describe("gtkx codegen (fixed-size array fields stored inline)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "inlinearray", "inlinearray.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "inlinearray", "inlinearray.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-inline-",
            config: fixtureConfig("InlineArray-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("reads and writes an array of numbers element by element", () => {
        expect(state.status).toBe(0);
        const declared = classBody(declarations(), "Frame");
        expect(INLINE_ARRAY_ACCESSORS.filter((text) => !declared.includes(text))).toEqual([]);
        const bound = classBody(bindings(), "Frame");
        expect(AXES_EMISSION.filter((pattern) => !pattern.test(bound))).toEqual([]);
    });

    it("reads and writes a record element as an instance of its own type", () => {
        expect(state.status).toBe(0);
        const bound = classBody(bindings(), "Frame");
        expect(bound).toMatch(CORNER_READ);
        expect(bound).toMatch(CORNER_WRITE);
        expect(INLINE_ELEMENT_DESCRIPTORS.filter((text) => !bindings().includes(text))).toEqual([]);
    });

    it("stores through the array fields that live inline and through no other", () => {
        expect(state.status).toBe(0);
        const emitted = `${classBody(declarations(), "Frame")}${classBody(bindings(), "Frame")}`;
        expect(INLINE_ARRAY_FIELDS.filter((name) => !emitted.includes(`set ${name}(`))).toEqual([]);
        expect(POINTER_ARRAY_FIELDS.filter((name) => emitted.includes(`set ${name}(`))).toEqual([]);
        expect(POINTER_ARRAY_FIELDS.filter((name) => !emitted.includes(`get ${name}(`))).toEqual([]);
        expect(classBody(bindings(), "Frame")).toMatch(POINTER_ARRAY_GETTER);
    });

    it("reaches an array the way it is stored and declares no member when it cannot", () => {
        expect(state.status).toBe(0);
        const frame = `${classBody(declarations(), "Frame")}${classBody(bindings(), "Frame")}`;
        expect(frame).toContain("get axes(");
        expect(OMITTED_ARRAY_FIELDS.flatMap((name) => omittedMentions(frame, name))).toEqual([]);
        const chain = classBody(bindings(), "Chain");
        expect(chain).toMatch(LENGTH_BOUNDED_READ);
        expect(chain).toContain("set links(");
    });
});

describe("gtkx codegen (callback arguments of vtable slots)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "hookslots", "hookslots.d.ts");
    const bindings = (): string => generatedModule(state.project, "gi", "hookslots", "hookslots.js");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-hook-slots-",
            config: fixtureConfig("HookSlots-1.0"),
        });

        state.status = runCli(state.project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("decodes a slot callback whose user data sits right after it", () => {
        expect(state.status).toBe(0);

        expect(bindings()).toContain(
            't.callback([t.int32, t.biguint64], t.boolean, { hasUserData: true, userDataIndex: 1, scope: "async" })',
        );

        expect(declarations()).toContain("vfuncBind(hook: HookFunc | null): void;");
    });

    it("keeps a slot callback that carries a destroy notify opaque", () => {
        expect(state.status).toBe(0);
        const watchSlot = bindings().split('vfuncName: "watch"', 2)[1] ?? "";

        expect(watchSlot).toContain(
            'argDescriptors: [t.object("borrowed"), t.biguint64, t.biguint64, t.biguint64]',
        );

        expect(declarations()).toContain(
            "vfuncWatch(hook: bigint | null, userData: bigint | null, destroy: bigint | null): void;",
        );
    });

    it("keeps a slot callback whose user data is not adjacent opaque", () => {
        expect(state.status).toBe(0);
        const deferSlot = bindings().split('vfuncName: "defer"', 2)[1] ?? "";

        expect(deferSlot).toContain(
            'argDescriptors: [t.object("borrowed"), t.biguint64, t.int32, t.biguint64]',
        );

        expect(declarations()).toContain(
            "vfuncDefer(hook: bigint | null, stride: number, userData: bigint | null): void;",
        );
    });
});
