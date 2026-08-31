import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { getWrapper, setWrapper } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import { spawn } from "node:child_process";
import { expect, test } from "vitest";
import { childEnv, fixtureArgs } from "./helpers/child-process.js";
import { didSettle, drainAfterEachTest, drainGC } from "./helpers/memory.js";

drainAfterEachTest();

const COMPILE_DEFAULT = GLib.RegexCompileFlags.DEFAULT;
const MATCH_DEFAULT = GLib.RegexMatchFlags.DEFAULT;

class NameObject extends GObject.Object {
    name = "";
}

registerClass(NameObject, { typeName: "GtkxNodeLifecycleNameObject" });

type ConstructionRecord = { self: ObservedObject; wrapper: object | null };

type Marker = { generation: number };

const constructionRecords: ConstructionRecord[] = [];

class ObservedObject extends GObject.Object {
    override vfuncConstructed() {
        constructionRecords.push({ self: this, wrapper: getWrapper(getHandle(this)) });
        super.vfuncConstructed();
    }
}

registerClass(ObservedObject, { typeName: "GtkxNodeLifecycleObservedObject" });

const churnAllocations = () => {
    const junk = [];

    for (let index = 0; index < 20_000; index += 1) {
        junk.push(`x${index.toString()}`.repeat(25));
    }

    return junk.at(-1);
};

const isCollected = async (weak: WeakRef<object>): Promise<boolean> => {
    await drainGC();

    return weak.deref() === undefined;
};

const detach = (factory: () => object): WeakRef<object> => new WeakRef(factory());

const appendTracked = (store: Gio.ListStore) => {
    const item = new Regress.TestObj({ int: 5 });
    store.append(item);

    return { handle: getHandle(item), weak: new WeakRef(item) };
};

const matchWithoutKeepingTheRegex = () => {
    const regex = GLib.Regex.new(String.raw`(\w+)-(\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("left-right", MATCH_DEFAULT);

    return { matched, info, weak: new WeakRef(regex) };
};

const runKeepAliveFixture = (mode: string): Promise<number | null> =>
    new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [...fixtureArgs("lifecycle-keep-alive.ts"), mode], {
            env: childEnv(),
            stdio: "ignore",
        });

        child.once("error", reject);
        child.once("close", (code) => {
            resolve(code);
        });
    });

test("a handle hands back the wrapper that was last set on it", () => {
    const object = new Regress.TestObj({ int: 3 });
    const handle = getHandle(object);
    expect(getWrapper(handle)).toBe(object);

    for (let generation = 1; generation <= 5; generation += 1) {
        const replacement = { generation };
        setWrapper(handle, replacement);
        expect(getWrapper(handle)).toBe(replacement);
        expect((getWrapper(handle) as Marker).generation).toBe(generation);
    }

    setWrapper(handle, object);
    expect(getWrapper(handle)).toBe(object);
    expect(object.int).toBe(3);
});

test("a registered subclass keeps its identity and its JavaScript state through a list store", () => {
    const item = new NameObject();
    item.name = "Persisted";

    const store = Gio.ListStore.new(NameObject);
    store.append(item);

    expect(store.getNItems()).toBe(1);
    expect(store.getItem(0)).toBe(item);
    expect(store.getItem(0)).toBe(store.getItem(0));
    expect((store.getItem(0) as NameObject).name).toBe("Persisted");
    expect(store.getItem(0) instanceof NameObject).toBeTruthy();
    expect(store.getItem(0) instanceof GObject.Object).toBeTruthy();

    store.removeAll();
    expect(store.getNItems()).toBe(0);
});

test("a wrapper held by a native reference survives forced collection", async () => {
    const store = Gio.ListStore.new(Regress.TestObj);
    const tracked = appendTracked(store);

    await drainGC(8);

    expect(tracked.weak.deref()).toBeDefined();
    expect(getWrapper(tracked.handle)).toBe(tracked.weak.deref());
    expect(store.getItem(0)).toBe(tracked.weak.deref());
    expect((store.getItem(0) as Regress.TestObj).int).toBe(5);

    store.removeAll();
    expect(await didSettle(() => isCollected(tracked.weak))).toBeTruthy();
});

test("detached wrappers are collected once nothing references them", async () => {
    const plain = detach(() => new Regress.TestObj({ int: 1 }));
    expect(await didSettle(() => isCollected(plain))).toBeTruthy();

    const registered = detach(() => new NameObject());
    expect(await didSettle(() => isCollected(registered))).toBeTruthy();
});

test("a registered subclass already owns its wrapper while constructed runs", () => {
    const instance = new ObservedObject();
    const record = constructionRecords.at(-1);

    expect(constructionRecords).toHaveLength(1);
    expect(record?.self).toBe(instance);
    expect(record?.wrapper).toBe(instance);
    expect(getWrapper(getHandle(instance))).toBe(instance);
    expect(instance instanceof ObservedObject).toBeTruthy();
    expect(instance instanceof GObject.Object).toBeTruthy();

    const second = new ObservedObject();
    expect(constructionRecords).toHaveLength(2);
    expect(constructionRecords.at(-1)?.wrapper).toBe(second);
    expect(second).not.toBe(instance);

    constructionRecords.length = 0;
});

test("constructing with an uncoercible property value throws", () => {
    // @ts-expect-error a symbol is not a string property value
    expect(() => new Regress.TestObj({ string: Symbol("title") })).toThrow();
    // @ts-expect-error a symbol is not an int property value
    expect(() => new Regress.TestObj({ int: Symbol("count") })).toThrow();
    // @ts-expect-error a symbol is not an object property value
    expect(() => new Regress.TestObj({ bare: Symbol("object") })).toThrow();
    // @ts-expect-error a plain object is not a string property value
    expect(() => new Regress.TestObj({ string: {} })).toThrow();
});

test("a match info reads every group after the subject string is churned over", () => {
    const regex = GLib.Regex.new(String.raw`(?P<user>\w+)@(?P<host>\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("hello@world", MATCH_DEFAULT);
    churnAllocations();

    expect(matched).toBe(true);
    expect(info.matches()).toBe(true);
    expect(info.getMatchCount()).toBe(3);
    churnAllocations();
    expect(info.fetchAll()).toEqual(["hello@world", "hello", "world"]);
    churnAllocations();
    expect(info.fetchNamed("user")).toBe("hello");
    churnAllocations();
    expect(info.fetchNamed("host")).toBe("world");
    churnAllocations();
    expect(info.getString()).toBe("hello@world");
    churnAllocations();
    expect(info.fetchPos(1)).toEqual([true, 0, 5]);
    churnAllocations();
    expect(info.fetchNamedPos("host")).toEqual([true, 6, 11]);
    churnAllocations();
    expect(info.expandReferences(String.raw`\1 at \2`)).toBe("hello at world");
    churnAllocations();
    expect(info.getRegex().getPattern()).toBe(String.raw`(?P<user>\w+)@(?P<host>\w+)`);
});

test("match all reports every overlapping match after churn", () => {
    const regex = GLib.Regex.new("a+", COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.matchAll("aaa", MATCH_DEFAULT);
    churnAllocations();

    expect(matched).toBe(true);
    expect(info.fetchAll()).toEqual(["aaa", "aa", "a"]);
    churnAllocations();
    expect(info.getString()).toBe("aaa");
});

test("a match info walks every match with next", () => {
    const regex = GLib.Regex.new(String.raw`\w+`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("one two three", MATCH_DEFAULT);
    const words = [];
    let hasMatch = matched;

    while (hasMatch) {
        churnAllocations();
        words.push(info.fetch(0));
        hasMatch = info.next();
    }

    expect(words).toEqual(["one", "two", "three"]);
    expect(info.matches()).toBe(false);
});

test("a match info that matched nothing still reports its subject", () => {
    const regex = GLib.Regex.new(String.raw`\d+`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("letters only", MATCH_DEFAULT);
    churnAllocations();

    expect(matched).toBe(false);
    expect(info.matches()).toBe(false);
    expect(info.getMatchCount()).toBe(0);
    expect(info.fetch(0)).toBeNull();
    churnAllocations();
    expect(info.fetchAll()).toEqual([]);
    expect(info.getString()).toBe("letters only");
});

test("match positions are byte offsets into a multibyte subject", () => {
    const regex = GLib.Regex.new("日本語", COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("aé日本語", MATCH_DEFAULT);
    churnAllocations();

    expect(matched).toBe(true);
    expect(info.fetchPos(0)).toEqual([true, 3, 12]);
    churnAllocations();
    expect(info.fetch(0)).toBe("日本語");
    expect(info.getString()).toBe("aé日本語");
});

test("groups outside the match report nothing instead of failing", () => {
    const regex = GLib.Regex.new(String.raw`(\w)(\w)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("ab", MATCH_DEFAULT);
    churnAllocations();

    expect(matched).toBe(true);
    expect(info.getMatchCount()).toBe(3);
    expect(info.fetch(42)).toBeNull();
    expect(info.fetchPos(42)).toEqual([false, 0, 0]);
    expect(info.fetchNamed("absent")).toBeNull();
    expect(info.fetchNamedPos("absent")).toEqual([false, 0, 0]);
});

test("a match info stays readable after its regex wrapper is collected", async () => {
    const { matched, info, weak } = matchWithoutKeepingTheRegex();

    expect(matched).toBe(true);
    expect(await didSettle(() => isCollected(weak))).toBeTruthy();
    churnAllocations();

    expect(info.fetchAll()).toEqual(["left-right", "left", "right"]);
    churnAllocations();
    expect(info.getString()).toBe("left-right");
    expect(info.getRegex().getPattern()).toBe(String.raw`(\w+)-(\w+)`);
});

test("compiling an invalid pattern throws", () => {
    expect(() => GLib.Regex.new("(", COMPILE_DEFAULT, MATCH_DEFAULT)).toThrow();
    expect(() => GLib.Regex.new("a{2,1}", COMPILE_DEFAULT, MATCH_DEFAULT)).toThrow();
    // @ts-expect-error a symbol is not a pattern
    expect(() => GLib.Regex.new(Symbol("pattern"), COMPILE_DEFAULT, MATCH_DEFAULT)).toThrow();
});

test("glib timeouts and idles dispatch through the node event loop", async () => {
    const fromTimeout = await new Promise((resolve) => {
        GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5, () => {
            resolve("timeout");

            return GLib.SOURCE_REMOVE;
        });
    });

    expect(fromTimeout).toBe("timeout");

    const fromIdle = await new Promise((resolve) => {
        GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
            resolve("idle");

            return GLib.SOURCE_REMOVE;
        });
    });

    expect(fromIdle).toBe("idle");
});

test("a timeout repeats until its callback asks to be removed", async () => {
    const ticks: number[] = [];

    await new Promise<void>((resolve) => {
        GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 1, () => {
            ticks.push(ticks.length);

            if (ticks.length === 3) {
                resolve();

                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    });

    expect(ticks).toEqual([0, 1, 2]);
});

test("a source removed before its deadline never runs", async () => {
    const seen = { hasFired: false };
    const id = GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5000, () => {
        seen.hasFired = true;

        return GLib.SOURCE_REMOVE;
    });

    expect(id > 0).toBeTruthy();
    expect(GLib.Source.remove(id)).toBe(true);

    await new Promise<void>((resolve) => {
        GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
            resolve();

            return GLib.SOURCE_REMOVE;
        });
    });

    expect(seen.hasFired).toBe(false);
});

test("a pending timeout alone does not keep the process alive", async () => {
    expect(await runKeepAliveFixture("released")).toBe(7);
});

test("keeping alive holds the process open until the pending timeout fires", async () => {
    expect(await runKeepAliveFixture("held")).toBe(0);
});

test("the wrapper and source APIs reject values of the wrong type", () => {
    const object = new Regress.TestObj({});
    const handle = getHandle(object);

    // @ts-expect-error a plain object is not a handle
    expect(() => getWrapper({})).toThrow();
    // @ts-expect-error a number is not a handle
    expect(() => getWrapper(42)).toThrow();
    expect(() => getHandle({})).toThrow();
    // @ts-expect-error a symbol owns no handle
    expect(() => getHandle(Symbol("handle"))).toThrow();
    expect(() => {
        // @ts-expect-error a number is not a wrapper
        setWrapper(handle, 42);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a wrapper is not nullable
        setWrapper(handle, null);
    }).toThrow();
    expect(() => {
        // @ts-expect-error a symbol is not a wrapper
        setWrapper(handle, Symbol("wrapper"));
    }).toThrow();
    expect(getWrapper(handle)).toBe(object);

    expect(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 1.5, () => GLib.SOURCE_REMOVE)).toThrow();
    // @ts-expect-error a symbol is not an interval
    expect(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, Symbol("interval"), () => GLib.SOURCE_REMOVE)).toThrow();
    expect(() => GLib.idleAdd(1.5, () => GLib.SOURCE_REMOVE)).toThrow();
});
