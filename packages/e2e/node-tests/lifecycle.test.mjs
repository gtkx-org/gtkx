import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Regress from "@gtkx/gi/regress";
import { getWrapper, setWrapper } from "@gtkx/native";
import { getHandle, registerClass } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { childEnv } from "./helpers/child-process.mjs";
import { drainAfterEachTest, drainGC, gcUntil } from "./helpers/memory.mjs";

drainAfterEachTest();

const COMPILE_DEFAULT = GLib.RegexCompileFlags.DEFAULT;
const MATCH_DEFAULT = GLib.RegexMatchFlags.DEFAULT;
const KEEP_ALIVE_FIXTURE = fileURLToPath(new URL("fixtures/lifecycle-keep-alive.mjs", import.meta.url));

class NameObject extends GObject.Object {
    name = "";
}

registerClass(NameObject, { typeName: "GtkxNodeLifecycleNameObject" });

const constructionRecords = [];

class ObservedObject extends GObject.Object {
    vfuncConstructed() {
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

const isCollected = async (weak) => {
    await drainGC();

    return weak.deref() === undefined;
};

const detach = (factory) => new WeakRef(factory());

const appendTracked = (store) => {
    const item = new Regress.TestObj({ int: 5 });
    store.append(item);

    return { handle: getHandle(item), weak: new WeakRef(item) };
};

const matchWithoutKeepingTheRegex = () => {
    const regex = GLib.Regex.new(String.raw`(\w+)-(\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("left-right", MATCH_DEFAULT);

    return { matched, info, weak: new WeakRef(regex) };
};

const runKeepAliveFixture = (mode) =>
    new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [KEEP_ALIVE_FIXTURE, mode], {
            env: childEnv(),
            stdio: "ignore",
        });

        child.once("error", reject);
        child.once("close", (code) => resolve(code));
    });

test("a handle hands back the wrapper that was last set on it", () => {
    const object = new Regress.TestObj({ int: 3 });
    const handle = getHandle(object);
    assert.equal(getWrapper(handle), object);

    for (let generation = 1; generation <= 5; generation += 1) {
        const replacement = { generation };
        setWrapper(handle, replacement);
        assert.equal(getWrapper(handle), replacement);
        assert.equal(getWrapper(handle).generation, generation);
    }

    setWrapper(handle, object);
    assert.equal(getWrapper(handle), object);
    assert.equal(object.int, 3);
});

test("a registered subclass keeps its identity and its JavaScript state through a list store", () => {
    const item = new NameObject();
    item.name = "Persisted";

    const store = Gio.ListStore.new(NameObject);
    store.append(item);

    assert.equal(store.getNItems(), 1);
    assert.equal(store.getItem(0), item);
    assert.equal(store.getItem(0), store.getItem(0));
    assert.equal(store.getItem(0).name, "Persisted");
    assert.ok(store.getItem(0) instanceof NameObject);
    assert.ok(store.getItem(0) instanceof GObject.Object);

    store.removeAll();
    assert.equal(store.getNItems(), 0);
});

test("a wrapper held by a native reference survives forced collection", async () => {
    const store = Gio.ListStore.new(Regress.TestObj);
    const tracked = appendTracked(store);

    await drainGC(8);

    assert.notEqual(tracked.weak.deref(), undefined);
    assert.equal(getWrapper(tracked.handle), tracked.weak.deref());
    assert.equal(store.getItem(0), tracked.weak.deref());
    assert.equal(store.getItem(0).int, 5);

    store.removeAll();
    assert.ok(await gcUntil(() => isCollected(tracked.weak)));
});

test("detached wrappers are collected once nothing references them", async () => {
    const plain = detach(() => new Regress.TestObj({ int: 1 }));
    assert.ok(await gcUntil(() => isCollected(plain)));

    const registered = detach(() => new NameObject());
    assert.ok(await gcUntil(() => isCollected(registered)));
});

test("a registered subclass already owns its wrapper while constructed runs", () => {
    const instance = new ObservedObject();
    const record = constructionRecords.at(-1);

    assert.equal(constructionRecords.length, 1);
    assert.equal(record.self, instance);
    assert.equal(record.wrapper, instance);
    assert.equal(getWrapper(getHandle(instance)), instance);
    assert.ok(instance instanceof ObservedObject);
    assert.ok(instance instanceof GObject.Object);

    const second = new ObservedObject();
    assert.equal(constructionRecords.length, 2);
    assert.equal(constructionRecords.at(-1).wrapper, second);
    assert.notEqual(second, instance);

    constructionRecords.length = 0;
});

test("constructing with an uncoercible property value throws", () => {
    assert.throws(() => new Regress.TestObj({ string: Symbol("title") }));
    assert.throws(() => new Regress.TestObj({ int: Symbol("count") }));
    assert.throws(() => new Regress.TestObj({ bare: Symbol("object") }));
    assert.throws(() => new Regress.TestObj({ string: {} }));
});

test("a match info reads every group after the subject string is churned over", () => {
    const regex = GLib.Regex.new(String.raw`(?P<user>\w+)@(?P<host>\w+)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("hello@world", MATCH_DEFAULT);
    churnAllocations();

    assert.equal(matched, true);
    assert.equal(info.matches(), true);
    assert.equal(info.getMatchCount(), 3);
    churnAllocations();
    assert.deepEqual(info.fetchAll(), ["hello@world", "hello", "world"]);
    churnAllocations();
    assert.equal(info.fetchNamed("user"), "hello");
    churnAllocations();
    assert.equal(info.fetchNamed("host"), "world");
    churnAllocations();
    assert.equal(info.getString(), "hello@world");
    churnAllocations();
    assert.deepEqual(info.fetchPos(1), [true, 0, 5]);
    churnAllocations();
    assert.deepEqual(info.fetchNamedPos("host"), [true, 6, 11]);
    churnAllocations();
    assert.equal(info.expandReferences(String.raw`\1 at \2`), "hello at world");
    churnAllocations();
    assert.equal(info.getRegex().getPattern(), String.raw`(?P<user>\w+)@(?P<host>\w+)`);
});

test("match all reports every overlapping match after churn", () => {
    const regex = GLib.Regex.new("a+", COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.matchAll("aaa", MATCH_DEFAULT);
    churnAllocations();

    assert.equal(matched, true);
    assert.deepEqual(info.fetchAll(), ["aaa", "aa", "a"]);
    churnAllocations();
    assert.equal(info.getString(), "aaa");
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

    assert.deepEqual(words, ["one", "two", "three"]);
    assert.equal(info.matches(), false);
});

test("a match info that matched nothing still reports its subject", () => {
    const regex = GLib.Regex.new(String.raw`\d+`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("letters only", MATCH_DEFAULT);
    churnAllocations();

    assert.equal(matched, false);
    assert.equal(info.matches(), false);
    assert.equal(info.getMatchCount(), 0);
    assert.equal(info.fetch(0), null);
    churnAllocations();
    assert.deepEqual(info.fetchAll(), []);
    assert.equal(info.getString(), "letters only");
});

test("match positions are byte offsets into a multibyte subject", () => {
    const regex = GLib.Regex.new("日本語", COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("aé日本語", MATCH_DEFAULT);
    churnAllocations();

    assert.equal(matched, true);
    assert.deepEqual(info.fetchPos(0), [true, 3, 12]);
    churnAllocations();
    assert.equal(info.fetch(0), "日本語");
    assert.equal(info.getString(), "aé日本語");
});

test("groups outside the match report nothing instead of failing", () => {
    const regex = GLib.Regex.new(String.raw`(\w)(\w)`, COMPILE_DEFAULT, MATCH_DEFAULT);
    const [matched, info] = regex.match("ab", MATCH_DEFAULT);
    churnAllocations();

    assert.equal(matched, true);
    assert.equal(info.getMatchCount(), 3);
    assert.equal(info.fetch(42), null);
    assert.deepEqual(info.fetchPos(42), [false, 0, 0]);
    assert.equal(info.fetchNamed("absent"), null);
    assert.deepEqual(info.fetchNamedPos("absent"), [false, 0, 0]);
});

test("a match info stays readable after its regex wrapper is collected", async () => {
    const { matched, info, weak } = matchWithoutKeepingTheRegex();

    assert.equal(matched, true);
    assert.ok(await gcUntil(() => isCollected(weak)));
    churnAllocations();

    assert.deepEqual(info.fetchAll(), ["left-right", "left", "right"]);
    churnAllocations();
    assert.equal(info.getString(), "left-right");
    assert.equal(info.getRegex().getPattern(), String.raw`(\w+)-(\w+)`);
});

test("compiling an invalid pattern throws", () => {
    assert.throws(() => GLib.Regex.new("(", COMPILE_DEFAULT, MATCH_DEFAULT));
    assert.throws(() => GLib.Regex.new("a{2,1}", COMPILE_DEFAULT, MATCH_DEFAULT));
    assert.throws(() => GLib.Regex.new(Symbol("pattern"), COMPILE_DEFAULT, MATCH_DEFAULT));
});

test("glib timeouts and idles dispatch through the node event loop", async () => {
    const fromTimeout = await new Promise((resolve) => {
        GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5, () => {
            resolve("timeout");

            return GLib.SOURCE_REMOVE;
        });
    });

    assert.equal(fromTimeout, "timeout");

    const fromIdle = await new Promise((resolve) => {
        GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
            resolve("idle");

            return GLib.SOURCE_REMOVE;
        });
    });

    assert.equal(fromIdle, "idle");
});

test("a timeout repeats until its callback asks to be removed", async () => {
    const ticks = [];

    await new Promise((resolve) => {
        GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 1, () => {
            ticks.push(ticks.length);

            if (ticks.length === 3) {
                resolve();

                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    });

    assert.deepEqual(ticks, [0, 1, 2]);
});

test("a source removed before its deadline never runs", async () => {
    const seen = { hasFired: false };
    const id = GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5000, () => {
        seen.hasFired = true;

        return GLib.SOURCE_REMOVE;
    });

    assert.ok(id > 0);
    assert.equal(GLib.Source.remove(id), true);

    await new Promise((resolve) => {
        GLib.idleAdd(GLib.PRIORITY_DEFAULT_IDLE, () => {
            resolve();

            return GLib.SOURCE_REMOVE;
        });
    });

    assert.equal(seen.hasFired, false);
});

test("a pending timeout alone does not keep the process alive", async () => {
    assert.equal(await runKeepAliveFixture("released"), 7);
});

test("keeping alive holds the process open until the pending timeout fires", async () => {
    assert.equal(await runKeepAliveFixture("held"), 0);
});

test("the wrapper and source APIs reject values of the wrong type", () => {
    const object = new Regress.TestObj({});
    const handle = getHandle(object);

    assert.throws(() => getWrapper({}));
    assert.throws(() => getWrapper(42));
    assert.throws(() => getHandle({}));
    assert.throws(() => getHandle(Symbol("handle")));
    assert.throws(() => setWrapper(handle, 42));
    assert.throws(() => setWrapper(handle, null));
    assert.throws(() => setWrapper(handle, Symbol("wrapper")));
    assert.equal(getWrapper(handle), object);

    assert.throws(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 1.5, () => GLib.SOURCE_REMOVE));
    assert.throws(() => GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, Symbol("interval"), () => GLib.SOURCE_REMOVE));
    assert.throws(() => GLib.idleAdd(1.5, () => GLib.SOURCE_REMOVE));
});
