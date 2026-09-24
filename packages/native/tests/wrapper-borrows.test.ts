import {
    alloc,
    type ExternalObject,
    getType,
    type Handle,
    newObject,
    resolveType,
    setWrapper,
    setWrapperBorrow,
} from "@gtkx/native";
import { expect, test } from "vitest";

type NativeHandle = ExternalObject<Handle>;
type Wrapper = { owner?: object };
type WrappedObject = { handle: NativeHandle; wrapper: Wrapper };
type LifetimeState = { calls: number; ownerType: bigint; dependentType: bigint };

const GOBJECT = "libgobject-2.0.so.0";
const OBJECT_TYPE = resolveType(GOBJECT, "g_object_get_type");
const ephemerons: WeakMap<object, object> = new WeakMap();

const wrappedObject = (): WrappedObject => {
    const wrapper: Wrapper = {};
    let handle: NativeHandle | undefined;

    newObject(OBJECT_TYPE, [], [], wrapper, (native) => {
        setWrapper(native, wrapper);
        handle = native;
    });

    if (handle === undefined) {
        throw new Error("The native object was not associated");
    }

    return { handle, wrapper };
};

const objectHandle = (): NativeHandle => {
    let handle: NativeHandle | undefined;

    newObject(OBJECT_TYPE, [], [], {}, (native) => {
        handle = native;
    });

    if (handle === undefined) {
        throw new Error("The native object was not associated");
    }

    return handle;
};

const collectUntil = async (isDone: () => boolean): Promise<void> => {
    for (let round = 0; round < 100; round++) {
        if (isDone()) {
            return;
        }
        await new Promise<void>((resolve) => setImmediate(resolve));
        globalThis.gc?.();
        await new Promise<void>((resolve) => setImmediate(resolve));
    }

    expect(isDone()).toBe(true);
};

const recordLifetime = (
    owner: NativeHandle,
    dependent: NativeHandle,
    state: LifetimeState,
): (() => void) =>
    () => {
        state.calls++;
        state.ownerType = getType(owner);
        state.dependentType = getType(dependent);
    };

const countFirst = (state: { first: number }): (() => void) =>
    () => {
        state.first++;
    };

const countSecond = (state: { second: number }): (() => void) =>
    () => {
        state.second++;
    };

const countCalls = (state: { calls: number }): (() => void) =>
    () => {
        state.calls++;
    };

const recordSelf = (handle: NativeHandle, state: { calls: number; type: bigint }): (() => void) =>
    () => {
        state.calls++;
        state.type = getType(handle);
    };

const recordCycle = (handle: NativeHandle, state: { calls: number }): (() => void) =>
    () => {
        state.calls++;
        getType(handle);
    };

const beginOwnerCleanup = () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    const state = { calls: 0, ownerType: 0n, dependentType: 0n };
    const ownerHandle = owner.handle;
    const dependentHandle = dependent.handle;

    setWrapperBorrow(ownerHandle, dependentHandle, recordLifetime(ownerHandle, dependentHandle, state));

    return {
        dependent: dependent.wrapper,
        owner: new WeakRef(owner.wrapper),
        state,
    };
};

const beginDependentCleanup = () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    const state = { calls: 0, ownerType: 0n, dependentType: 0n };
    const ownerHandle = owner.handle;
    const dependentHandle = dependent.handle;

    setWrapperBorrow(ownerHandle, dependentHandle, recordLifetime(ownerHandle, dependentHandle, state));

    return {
        dependent: new WeakRef(dependent.wrapper),
        owner: owner.wrapper,
        state,
    };
};

const beginReplacement = () => {
    const owner = wrappedObject();
    const first = wrappedObject();
    const second = wrappedObject();
    const state = { first: 0, second: 0 };

    setWrapperBorrow(owner.handle, first.handle, countFirst(state));
    setWrapperBorrow(owner.handle, second.handle, countSecond(state));

    return {
        first: new WeakRef(first.wrapper),
        owner: owner.wrapper,
        second: new WeakRef(second.wrapper),
        state,
    };
};

const beginClear = () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    const state = { calls: 0 };

    setWrapperBorrow(owner.handle, dependent.handle, countCalls(state));
    setWrapperBorrow(owner.handle, null, null);

    return {
        dependent: new WeakRef(dependent.wrapper),
        owner: new WeakRef(owner.wrapper),
        state,
    };
};

const beginSelfBorrow = () => {
    const value = wrappedObject();
    const state = { calls: 0, type: 0n };
    const handle = value.handle;

    setWrapperBorrow(handle, handle, recordSelf(handle, state));

    return { state, wrapper: new WeakRef(value.wrapper) };
};

const beginCycle = () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    const state = { calls: 0 };
    const ownerHandle = owner.handle;

    dependent.wrapper.owner = owner.wrapper;
    ephemerons.set(owner.wrapper, dependent.wrapper);
    if (ephemerons.get(owner.wrapper) !== dependent.wrapper) {
        throw new Error("The ephemeron was not stored");
    }
    setWrapperBorrow(ownerHandle, dependent.handle, recordCycle(ownerHandle, state));

    return {
        dependent: new WeakRef(dependent.wrapper),
        owner: new WeakRef(owner.wrapper),
        state,
    };
};

const beginReentrantClear = () => {
    const first = wrappedObject();
    const second = wrappedObject();
    const dependent = wrappedObject();
    const state = { first: 0, second: 0 };
    const firstHandle = first.handle;
    const secondHandle = second.handle;

    setWrapperBorrow(firstHandle, dependent.handle, () => {
        state.first++;
        setWrapperBorrow(secondHandle, null, null);
    });
    setWrapperBorrow(secondHandle, dependent.handle, () => {
        state.second++;
        setWrapperBorrow(firstHandle, null, null);
    });

    return {
        dependent: new WeakRef(dependent.wrapper),
        owners: [first.wrapper, second.wrapper],
        state,
    };
};

const beginReentrantReplacement = () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    const replacementDependent = wrappedObject();
    const ownerHandle = owner.handle;
    const replacementDependentHandle = replacementDependent.handle;
    const state: { cleanupCalls: number; replacementCalls: number; replacement?: Wrapper } = {
        cleanupCalls: 0,
        replacementCalls: 0,
    };

    setWrapperBorrow(ownerHandle, dependent.handle, () => {
        state.cleanupCalls++;
        const replacement: Wrapper = {};
        setWrapper(ownerHandle, replacement);
        state.replacement = replacement;
        setWrapperBorrow(ownerHandle, replacementDependentHandle, () => {
            state.replacementCalls++;
        });
    });

    return {
        dependent: dependent.wrapper,
        owner: new WeakRef(owner.wrapper),
        ownerHandle,
        replacementDependent: replacementDependent.wrapper,
        state,
    };
};

test("owner cleanup releases a wrapper borrow before either native object expires", async () => {
    const subject = beginOwnerCleanup();

    await collectUntil(() => subject.owner.deref() === undefined && subject.state.calls === 1);

    expect(subject.dependent).toBeDefined();
    expect(subject.state).toEqual({ calls: 1, ownerType: OBJECT_TYPE, dependentType: OBJECT_TYPE });
});

test("dependent cleanup releases a wrapper borrow while its owner remains live", async () => {
    const subject = beginDependentCleanup();

    await collectUntil(() => subject.dependent.deref() === undefined && subject.state.calls === 1);

    expect(subject.owner).toBeDefined();
    expect(subject.state).toEqual({ calls: 1, ownerType: OBJECT_TYPE, dependentType: OBJECT_TYPE });
});

test("replacement and clear remove old wrapper borrows without invoking them", async () => {
    const replacement = beginReplacement();

    await collectUntil(
        () =>
            replacement.first.deref() === undefined &&
            replacement.second.deref() === undefined &&
            replacement.state.second === 1,
    );

    expect(replacement.owner).toBeDefined();
    expect(replacement.state).toEqual({ first: 0, second: 1 });

    const cleared = beginClear();

    await collectUntil(() => cleared.owner.deref() === undefined && cleared.dependent.deref() === undefined);

    expect(cleared.state.calls).toBe(0);
});

test("self borrows and ephemeron cycles remain collectable", async () => {
    const self = beginSelfBorrow();

    await collectUntil(() => self.wrapper.deref() === undefined && self.state.calls === 1);

    expect(self.state).toEqual({ calls: 1, type: OBJECT_TYPE });

    const cycle = beginCycle();

    await collectUntil(
        () => cycle.owner.deref() === undefined && cycle.dependent.deref() === undefined && cycle.state.calls === 1,
    );

    expect(cycle.state.calls).toBe(1);
});

test("cleanup can clear another pending wrapper borrow", async () => {
    const subject = beginReentrantClear();

    await collectUntil(
        () => subject.dependent.deref() === undefined && subject.state.first + subject.state.second >= 1,
    );

    expect(subject.owners).toHaveLength(2);
    expect(subject.state.first + subject.state.second).toBe(1);
});

test("cleanup preserves a replacement borrow on a regenerated wrapper", async () => {
    const subject = beginReentrantReplacement();

    await collectUntil(() => subject.owner.deref() === undefined && subject.state.cleanupCalls === 1);

    expect(subject.dependent).toBeDefined();
    expect(subject.replacementDependent).toBeDefined();
    expect(subject.state.replacement).toBeDefined();
    expect(subject.state.replacementCalls).toBe(0);
    setWrapperBorrow(subject.ownerHandle, null, null);
});

test("wrapper borrows reject invalid handles and incomplete pairs", () => {
    const owner = wrappedObject();
    const dependent = wrappedObject();
    let cleanupCalls = 0;
    const cleanup = (): void => {
        cleanupCalls++;
    };

    expect(() => {
        setWrapperBorrow(alloc(16), dependent.handle, cleanup);
    }).toThrow();
    expect(() => {
        setWrapperBorrow(owner.handle, objectHandle(), cleanup);
    }).toThrow();
    expect(() => {
        setWrapperBorrow(objectHandle(), dependent.handle, cleanup);
    }).toThrow();
    expect(() => {
        Reflect.apply(setWrapperBorrow, null, [owner.handle, dependent.handle]);
    }).toThrow();
    expect(() => {
        setWrapperBorrow(owner.handle, null, cleanup);
    }).toThrow();
    expect(cleanupCalls).toBe(0);
});
