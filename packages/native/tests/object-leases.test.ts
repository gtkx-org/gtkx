import {
    alloc,
    bind,
    bindField,
    call,
    copy,
    type Descriptor,
    type ExternalObject,
    getType,
    getWrapper,
    type Handle,
    init,
    newObject,
    quit,
    read,
    readField,
    resolveType,
    setWrapper,
    write,
} from "@gtkx/native";
import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

type NativeHandle = ExternalObject<Handle>;
type BoundFunction = ReturnType<typeof bind>;
type Subject = { handle: NativeHandle; alias: NativeHandle; nested: NativeHandle; wrapper: WeakRef<object> };
type Fixture = {
    library: string;
    type: bigint;
    valueOffset: number;
    prepare: BoundFunction;
    start: BoundFunction;
    finalized: BoundFunction;
    release: BoundFunction;
    cancel: BoundFunction;
};
type CallSource = { name: string; descriptor: Descriptor; select: (subject: Subject) => NativeHandle };

const VOID: Descriptor = { kind: "void" };
const INT: Descriptor = { kind: "int32" };
const OBJECT: Descriptor = { kind: "object", ownership: "borrowed" };
const BUFFER: Descriptor = { kind: "buffer" };
const INLINE: Descriptor = { kind: "struct", isInline: true, ownership: "borrowed", size: 4 };
const CALLBACK: Descriptor = { kind: "callback", scope: "call", argDescriptors: [], returnDescriptor: VOID };
const sources: CallSource[] = [
    { name: "object argument", descriptor: OBJECT, select: (subject) => subject.handle },
    { name: "buffer argument", descriptor: BUFFER, select: (subject) => subject.handle },
    { name: "inline field argument", descriptor: BUFFER, select: (subject) => subject.alias },
    { name: "nested field argument", descriptor: BUFFER, select: (subject) => subject.nested },
];
const temporary = mkdtempSync(join(tmpdir(), "gtkx-object-worker-"));
const state: { fixture: Fixture | null } = { fixture: null };

beforeAll(() => {
    const library = join(temporary, "libgtkx-object-worker.so");
    const flags = execFileSync(resolveExecutable("pkg-config"), ["--cflags", "--libs", "gobject-2.0"], {
        encoding: "utf8",
    }).trim().split(/\s+/);
    execFileSync(resolveExecutable("cc"), [
        "-shared", "-fPIC", "-Wall", "-Wextra", "-Werror",
        join(import.meta.dirname, "fixtures/object-worker.c"), "-o", library, ...flags,
    ]);
    const offset = bind(library, "gtkx_worker_object_value_offset", [], { kind: "uint32" });
    state.fixture = {
        library,
        type: resolveType(library, "gtkx_worker_object_get_type"),
        valueOffset: call(offset, []).value as number,
        prepare: bind(library, "gtkx_worker_prepare", [OBJECT], VOID),
        start: bind(library, "gtkx_worker_start", [], VOID),
        finalized: bind(library, "gtkx_worker_is_finalized", [], INT),
        release: bind(library, "gtkx_worker_release", [BUFFER], INT),
        cancel: bind(library, "gtkx_worker_cancel", [], VOID),
    };
});

afterAll(() => {
    rmSync(temporary, { recursive: true, force: true });
});

const fixtureFor = (): Fixture => {
    if (state.fixture === null) {
        throw new Error("The native fixture was not built");
    }

    return state.fixture;
};

const createSubject = (fixture: Fixture): Subject => {
    const wrapper = {};
    let result: NativeHandle | undefined;
    newObject(fixture.type, [], [], wrapper, (handle) => {
        setWrapper(handle, wrapper);
        result = handle;
    });

    if (result === undefined) {
        throw new Error("The native object was not associated");
    }

    const alias = read(result, INLINE, fixture.valueOffset) as NativeHandle;
    const nested = read(alias, INLINE, 0) as NativeHandle;
    call(fixture.prepare, [result]);
    quit();
    call(fixture.start, []);

    return { handle: result, alias, nested, wrapper: new WeakRef(wrapper) };
};

const collectWrapper = async (subject: Subject): Promise<void> => {
    for (let cycle = 0; cycle < 10; cycle++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        globalThis.gc?.();
    }

    expect(subject.wrapper.deref()).toBeUndefined();
    init();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
};

test.each(sources)("a native worker release cannot expire an in-flight $name", async ({ descriptor, select }) => {
    const fixture = fixtureFor();
    const subject = createSubject(fixture);

    try {
        await collectWrapper(subject);
        expect(call(fixture.finalized, []).value).toBe(0);
        expect(read(subject.alias, INT, 0)).toBe(42);
        const release = bind(fixture.library, "gtkx_worker_release", [descriptor], INT);
        const duringCall = call(release, [select(subject)]).value;
        expect(duringCall).toBe(0);
        expect(call(fixture.finalized, []).value).toBe(1);
        expect(getType(subject.handle)).toBe(0n);
        expect(() => read(subject.alias, INT, 0)).toThrow();
        expect(() => readField(bindField(INT), subject.nested, 0)).toThrow();
        expect(() => copy(alloc(4), subject.alias, 4)).toThrow();
        expect(() => copy(subject.nested, alloc(4), 4)).toThrow();
    } finally {
        init();

        call(fixture.cancel, []);
    }
});

test("a reentrant native call keeps its enclosing object's lease alive", async () => {
    const fixture = fixtureFor();
    const subject = createSubject(fixture);
    const nested = bind(fixture.library, "gtkx_worker_release_nested", [BUFFER, CALLBACK], INT);

    try {
        await collectWrapper(subject);
        const duringCall = call(nested, [subject.nested, () => {
            call(fixture.release, [null]);
        }]).value;
        expect(duringCall).toBe(0);
        expect(call(fixture.finalized, []).value).toBe(1);
    } finally {
        init();

        call(fixture.cancel, []);
    }
});

test("a rejected callback releases its enclosing native object's lease", async () => {
    const fixture = fixtureFor();
    const subject = createSubject(fixture);
    const nested = bind(fixture.library, "gtkx_worker_release_nested", [BUFFER, CALLBACK], INT);

    try {
        await collectWrapper(subject);
        expect(() => {
            call(nested, [subject.nested, () => {
                throw new Error("The callback rejected the operation");
            }]);
        }).toThrow();
        call(fixture.cancel, []);
        expect(call(fixture.finalized, []).value).toBe(1);
    } finally {
        init();
        call(fixture.cancel, []);
    }
});

test("disposed objects remain usable while their JavaScript wrapper is live", () => {
    const fixture = fixtureFor();
    const wrapper = {};
    let result: NativeHandle | undefined;
    newObject(fixture.type, [], [], wrapper, (handle) => {
        setWrapper(handle, wrapper);
        result = handle;
    });

    if (result === undefined) {
        throw new Error("The native object was not associated");
    }

    const handle = result;
    const alias = read(handle, INLINE, fixture.valueOffset) as NativeHandle;
    const dispose = bind("libgobject-2.0.so.0", "g_object_run_dispose", [OBJECT], VOID);
    const equal = bind("libglib-2.0.so.0", "g_direct_equal", [BUFFER, BUFFER], INT);
    call(dispose, [handle]);
    expect(getType(handle)).toBe(fixture.type);
    expect(read(alias, INT, 0)).toBe(42);
    write(alias, INT, 0, 43);
    expect(read(alias, INT, 0)).toBe(43);
    expect(call(equal, [handle, handle]).value).toBe(1);
    expect(call(equal, [alias, alias]).value).toBe(1);
    expect(getWrapper(handle)).toBe(wrapper);
});
