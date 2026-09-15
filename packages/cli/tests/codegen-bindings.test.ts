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
    PURE,
    RECORD_FIELD_ACCESSORS,
} from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const STATIC_NARROW_MODULE = "@gtkx/gi/staticnarrow";
const STATIC_NARROW_PROBE = `import { Base, Compact, Derived, Leaf } from "${STATIC_NARROW_MODULE}";

const base: Base = Base.new();
const derived: Derived = Derived.new();
const compact: Compact = Compact.new();
const leaf: Leaf = Leaf.new();
export const parsed: [Base | null, number] = Base.parse("value");

export const values = [base.lookup("value"), derived.lookup(1), leaf.lookup(1), compact.measure(), base.measure(1)];
`;
const STATIC_NARROW_REJECTED: Record<string, string> = {
    "inherited-signature.ts": `import { Derived } from "${STATIC_NARROW_MODULE}";
export const value = Derived.new().lookup("value");
`,
    "inherited-signature-below.ts": `import { Leaf } from "${STATIC_NARROW_MODULE}";
export const value = Leaf.new().lookup("value");
`,
    "dropped-parameter.ts": `import { Compact } from "${STATIC_NARROW_MODULE}";
export const value = Compact.new().measure(1);
`,
    "nullable-constructor-tuple.ts": `import { Base } from "${STATIC_NARROW_MODULE}";
export const value: [Base, number] = Base.parse("value");
`,
    "omitted-constructor-output.ts": `import { Base } from "${STATIC_NARROW_MODULE}";
export const value: Base | null = Base.parse("value");
`,
};
const MISSING_GIR_CONFIG =
    `export default { applicationId: "com.gtkx.clicodegen", libraries: ${JSON.stringify(["Documented-1.0"])}, ` +
    `girPath: ${JSON.stringify(["/nonexistent"])} };\n`;
const SHARED_IMPORT_CONFIG = `export default {
    applicationId: "org.gtkx.sharedimports",
    libraries: ["Gio-2.0"],
    elements: { config: {
        GObject: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GSimpleAction: { props: { module: "@gtkx/gi/gobject", export: "ObjectConstructorProps" } },
        GBindingGroup: { props: { module: "react", export: "Attributes" } },
    } },
};`;
const NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: "group" };
`;
const SHARED_IMPORT_PROBE = `import type { GObjectProps } from "@gtkx/jsx/gobject";
import type { GSimpleActionProps } from "@gtkx/jsx/gio";
export const object: GObjectProps = {};
export const action: GSimpleActionProps = { name: "open" };
`;
const REJECTED_NAMED_PROPS_PROBE = `import type { GBindingGroupProps } from "@gtkx/jsx/gobject";
export const group: GBindingGroupProps = { key: {} };
`;

describe("gtkx codegen (libraries the generated types have to escape)", () => {
    const state: { project: CliProject; status: number | null } = {
        project: { root: "", nodeModules: "" },
        status: null,
    };

    const declarations = (): string => generatedModule(state.project, "gi", "staticnarrow", "staticnarrow.d.ts");

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-codegen-statics-",
            config: fixtureConfig("StaticNarrow-1.0"),
            files: { "probe.ts": STATIC_NARROW_PROBE, ...STATIC_NARROW_REJECTED },
        });

        state.status = runCli(state.project, ["codegen"]).status;
        isolateTypeConsumer(state.project);
    });

    afterAll(() => {
        removeCliProject(state.project);
    });

    it("binds a class whose factory return and instance method narrow the ones it inherits", () => {
        expect(state.status).toBe(0);
        expect(declarations()).toContain("StaticBase<");
        expect(classBody(declarations(), "Derived")).toContain("lookup(value: number): number;");
        expect(classBody(declarations(), "Derived")).not.toContain("this: never");
        expect(typecheckFile(state.project, "probe.ts")).toBe(0);
    });

    it("declares a narrowing that stays assignable to the inherited method directly on the class", () => {
        expect(state.status).toBe(0);
        expect(classBody(declarations(), "Compact")).toContain("measure(): number;");
        expect(declarations()).not.toContain("_Compact$InstanceBase");
        expect(declarations()).not.toContain("_Leaf$InstanceBase");
    });

    it("bridges no method the class leaves to the runtime", () => {
        expect(state.status).toBe(0);
        expect(declarations()).not.toContain("ref(");
    });

    it.each(Object.keys(STATIC_NARROW_REJECTED))("rejects an incompatible consumer in %s", (file) => {
        expect(state.status).toBe(0);
        expect(typecheckFile(state.project, file)).not.toBe(0);
    });

    it("binds a type whose GIR name starts with a digit", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-digit-",
            config: fixtureConfig("DigitName-1.0"),
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(generatedModule(project, "gi", "digitname", "digitname.d.ts")).toContain("enum _80211Mode");

        expect(generatedModule(project, "gi", "digitname", "digitname.js")).toContain(
            `= ${PURE} t.fn("libdigitname.so.0", "digit_name_radio_get_mode", () => (`,
        );
    });

    it("escapes reserved bindings and type names without changing GIR acronym casing", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-reserved-",
            config: fixtureConfig("ReservedNames-1.0"),
            files: {
                "probe.ts": `import {
    class_, class__, number_, number__, default_, await_, arguments_, getHTTPStatus,
} from "@gtkx/gi/reservednames";
export const values = [class_.FIRST, class__.FIRST, number_.FIRST, number__.FIRST];
export const invoke = () => {
    default_(class_.FIRST, number_.FIRST);
    await_();
    arguments_();
    return getHTTPStatus();
};
`,
                "rejected.ts": `import { number as NumberType } from "@gtkx/gi/reservednames";
export const value = NumberType.FIRST;
`,
            },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(typecheckFile(project, "probe.ts")).toBe(0);
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
    });
});

describe("gtkx codegen (configured props imports)", () => {
    let project: CliProject;
    let status: number | null;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-cli-codegen-shared-imports-",
            config: SHARED_IMPORT_CONFIG,
            files: {
                "named.ts": NAMED_PROPS_PROBE,
                "shared.ts": SHARED_IMPORT_PROBE,
                "rejected.ts": REJECTED_NAMED_PROPS_PROBE,
            },
        });
        status = runCli(project, ["codegen"]).status;
    });

    afterAll(() => {
        removeCliProject(project);
    });

    it("exposes props imported by name from another package", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "named.ts")).toBe(0);
    });

    it("combines named props imports with runtime and type-only GI namespaces", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "shared.ts")).toBe(0);
    });

    it("rejects values incompatible with the imported props", () => {
        expect(status).toBe(0);
        expect(typecheckFile(project, "rejected.ts")).not.toBe(0);
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

    it.each(DOCUMENTED_MODULE_CASES)(
        "documents $title in its declaration alone",
        ({ store, stem, docs, stripped }) => {
            expect(state.status).toBe(0);
            const declared = generatedModule(state.project, store, `${stem}.d.ts`);
            expect(docs.filter((text) => !declared.includes(text))).toEqual([]);
            expect(stripped.filter((text) => declared.includes(text))).toEqual([]);
            const emitted = generatedModule(state.project, store, `${stem}.js`).split(PURE).join("");
            expect(emitted).not.toMatch(COMMENT);
        },
    );

    it.each(HOVER_CASES)("surfaces the documentation of $title on hover", ({ text, doc, omits }) => {
        expect(state.status).toBe(0);
        const hover = hoverDoc(state.project, join("src", "probe.tsx"), text);
        expect(hover).toContain(doc);
        expect(omits.filter((entry) => hover.includes(entry))).toEqual([]);
    });

    it("fails when the documented library has no GIR file on the search path", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-docs-missing-",
            config: MISSING_GIR_CONFIG,
        });

        expect(runCli(project, ["codegen"]).status).not.toBe(0);
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
            'argDescriptors: [t.object("borrowed", () => Station, "HookSlotsStation"), ' +
            "t.biguint64, t.biguint64, t.biguint64]",
        );

        expect(declarations()).toContain(
            "vfuncWatch(hook: bigint | null, userData: bigint | null, destroy: bigint | null): void;",
        );
    });

    it("keeps a slot callback whose user data is not adjacent opaque", () => {
        expect(state.status).toBe(0);
        const deferSlot = bindings().split('vfuncName: "defer"', 2)[1] ?? "";

        expect(deferSlot).toContain(
            'argDescriptors: [t.object("borrowed", () => Station, "HookSlotsStation"), ' +
            "t.biguint64, t.int32, t.biguint64]",
        );

        expect(declarations()).toContain(
            "vfuncDefer(hook: bigint | null, stride: number, userData: bigint | null): void;",
        );
    });
});
