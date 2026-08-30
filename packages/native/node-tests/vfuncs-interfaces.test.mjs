import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import { callParent, getClassType, getInstanceType, registerClass, typeIsA } from "@gtkx/runtime";
import assert from "node:assert/strict";
import { test } from "node:test";
import { drainGC, installMemoryGuard } from "./helpers/memory.mjs";

installMemoryGuard();

const createTypeNameFactory = () => {
    let index = 0;

    return (prefix) => {
        index += 1;

        return `${prefix}Vfunc${String(process.pid)}_${String(index)}`;
    };
};

const uniqueName = createTypeNameFactory();

const READWRITE = GObject.ParamFlags.READWRITE;

const registerDeferredInitable = (typeName, captured) => {
    class DeferredInit extends GObject.Object {
        vfuncInitAsync(ioPriority, cancellable, callback) {
            captured.push(callback);
        }
    }

    return registerClass(DeferredInit, { typeName, implements: [Gio.AsyncInitable] });
};

test("a registered subclass fills the int8 vtable slots the C callers dispatch to", () => {
    const seen = [];

    class Int8Slots extends GIMarshallingTests.Object {
        vfuncMethodInt8In(in_) {
            seen.push(in_);
        }

        vfuncMethodInt8Out() {
            return -5;
        }

        vfuncMethodInt8ArgAndOutCaller(arg) {
            return arg * 2;
        }

        vfuncMethodInt8ArgAndOutCallee(arg) {
            return arg + 1;
        }

        vfuncMethodStrArgOutRet(arg) {
            return [`${arg}!`, 9];
        }
    }

    const Registered = registerClass(Int8Slots, { typeName: uniqueName("GtkxInt8Slots") });
    const instance = new Registered({});
    assert.ok(instance instanceof Int8Slots);
    assert.ok(instance instanceof GIMarshallingTests.Object);
    assert.ok(instance instanceof GObject.Object);

    instance.methodInt8In(42);
    instance.int8In(-7);
    assert.deepEqual(seen, [42, -7]);

    assert.equal(instance.methodInt8Out(), -5);
    assert.equal(instance.int8Out(), -5);
    assert.equal(instance.methodInt8ArgAndOutCaller(3), 6);
    assert.equal(instance.vfuncMethodInt8ArgAndOutCallee(41), 42);
    assert.deepEqual(instance.methodStrArgOutRet("hi"), ["hi!", 9]);
});

test("an override reaches the implementation it replaces through super", () => {
    const seen = [];

    class Chained extends GIMarshallingTests.Object {
        vfuncMethodWithDefaultImplementation(in_) {
            seen.push(in_);
            super.vfuncMethodWithDefaultImplementation(in_ + 1);
        }
    }

    const Registered = registerClass(Chained, { typeName: uniqueName("GtkxChained") });
    const instance = new Registered({});
    instance.methodWithDefaultImplementation(10);
    assert.deepEqual(seen, [10]);
    assert.equal(instance.int, 11);
});

test("an override reaches the parent implementation through callParent", () => {
    const seen = [];

    class Parented extends GIMarshallingTests.Object {
        vfuncMethodWithDefaultImplementation(in_) {
            seen.push(in_);
            callParent(Parented, "vfuncMethodWithDefaultImplementation", this, in_ + 2);
        }
    }

    const Registered = registerClass(Parented, { typeName: uniqueName("GtkxParented") });
    const instance = new Registered({});
    instance.methodWithDefaultImplementation(5);
    assert.deepEqual(seen, [5]);
    assert.equal(instance.int, 7);
});

test("a slot filled several types up the hierarchy is reached from a JavaScript override", () => {
    const seen = [];

    class DeepHierarchy extends GIMarshallingTests.SubSubObject {
        vfuncMethodDeepHierarchy(in_) {
            seen.push(in_);
            super.vfuncMethodDeepHierarchy(in_ + 1);
        }
    }

    const Registered = registerClass(DeepHierarchy, { typeName: uniqueName("GtkxDeepHierarchy") });
    const instance = new Registered({});
    assert.ok(instance instanceof GIMarshallingTests.SubObject);
    instance.vfuncMethodDeepHierarchy(10);
    assert.deepEqual(seen, [10]);
    assert.equal(instance.int, 11);

    instance.methodWithDefaultImplementation(3);
    assert.equal(instance.int, 3);
});

test("vfunc slots with a return value and out parameters marshal them back to C", () => {
    class Returning extends GIMarshallingTests.Object {
        vfuncVfuncReturnValueOnly() {
            return 42n;
        }

        vfuncVfuncOneOutParameter() {
            return 0.5;
        }

        vfuncVfuncMultipleOutParameters() {
            return [1.5, 2.5];
        }

        vfuncVfuncArrayOutParameter() {
            return [1.5, 2.5, 3.5];
        }

        vfuncVfuncReturnValueAndOneOutParameter() {
            return [42n, 43n];
        }

        vfuncVfuncReturnValueAndMultipleOutParameters() {
            return [42n, 43n, 44n];
        }
    }

    const Registered = registerClass(Returning, { typeName: uniqueName("GtkxReturning") });
    const instance = new Registered({});

    assert.equal(instance.vfuncReturnValueOnly(), 42n);
    assert.equal(instance.vfuncOneOutParameter(), 0.5);
    assert.deepEqual(instance.vfuncMultipleOutParameters(), [1.5, 2.5]);
    assert.deepEqual(instance.vfuncArrayOutParameter(), [1.5, 2.5, 3.5]);
    assert.deepEqual(instance.vfuncReturnValueAndOneOutParameter(), [42n, 43n]);
    assert.deepEqual(instance.vfuncReturnValueAndMultipleOutParameters(), [42n, 43n, 44n]);
});

test("inout vfunc parameters arrive seeded and travel back to the C caller", () => {
    const seen = [];

    class Inout extends GIMarshallingTests.Object {
        vfuncVfuncOneInoutParameter(a) {
            seen.push(a);

            return a * 2;
        }

        vfuncVfuncMultipleInoutParameters(a, b) {
            seen.push(a, b);

            return [a * 2, b * 2];
        }

        vfuncVfuncReturnValueAndOneInoutParameter(a) {
            seen.push(a);

            return [42n, a * 2n];
        }

        vfuncVfuncReturnValueAndMultipleInoutParameters(a, b) {
            seen.push(a, b);

            return [42n, a * 2n, b * 2n];
        }
    }

    const Registered = registerClass(Inout, { typeName: uniqueName("GtkxInout") });
    const instance = new Registered({});

    assert.equal(instance.vfuncOneInoutParameter(2.5), 5);
    assert.deepEqual(instance.vfuncMultipleInoutParameters(1.5, 2.5), [3, 5]);
    assert.deepEqual(instance.vfuncReturnValueAndOneInoutParameter(3n), [42n, 6n]);
    assert.deepEqual(instance.vfuncReturnValueAndMultipleInoutParameters(3n, 4n), [42n, 6n, 8n]);
    assert.deepEqual(seen, [2.5, 1.5, 2.5, 3n, 3n, 4n]);
});

test("enum and flags vfunc slots marshal their members in both directions", () => {
    class Enums extends GIMarshallingTests.Object {
        vfuncVfuncReturnEnum() {
            return GIMarshallingTests.Enum.VALUE3;
        }

        vfuncVfuncOutEnum() {
            return GIMarshallingTests.Enum.VALUE2;
        }

        vfuncVfuncReturnFlags() {
            return GIMarshallingTests.Flags.VALUE2;
        }

        vfuncVfuncOutFlags() {
            return GIMarshallingTests.Flags.VALUE3;
        }
    }

    const Registered = registerClass(Enums, { typeName: uniqueName("GtkxEnums") });
    const instance = new Registered({});

    assert.equal(instance.vfuncReturnEnum(), GIMarshallingTests.Enum.VALUE3);
    assert.equal(instance.vfuncOutEnum(), GIMarshallingTests.Enum.VALUE2);
    assert.equal(instance.vfuncReturnFlags(), GIMarshallingTests.Flags.VALUE2);
    assert.equal(instance.vfuncOutFlags(), GIMarshallingTests.Flags.VALUE3);
});

test("a caller-allocated GValue out parameter is filled from the override", () => {
    const seen = [];

    class CallerAllocated extends GIMarshallingTests.Object {
        vfuncVfuncCallerAllocatedOutParameter(a) {
            seen.push(a instanceof GObject.Value);
            const value = new GObject.Value();
            value.init(GObject.typeFromName("gint"));
            value.setInt(42);

            return value;
        }
    }

    const Registered = registerClass(CallerAllocated, { typeName: uniqueName("GtkxCallerAllocated") });
    const instance = new Registered({});

    assert.equal(instance.vfuncCallerAllocatedOutParameter(), 42);
    assert.deepEqual(seen, [true]);
});

test("a call-scoped callback handed to a vfunc runs from JavaScript", () => {
    const seen = [];

    class WithCallback extends GIMarshallingTests.Object {
        vfuncVfuncWithCallback(callback) {
            seen.push(typeof callback, callback(5), callback(-3));
        }
    }

    const Registered = registerClass(WithCallback, { typeName: uniqueName("GtkxWithCallback") });
    const instance = new Registered({});
    instance.callVfuncWithCallback();
    assert.deepEqual(seen, ["function", 5, -3]);
});

test("a vfunc that reports success returns its value to the C caller", () => {
    const seen = [];

    class Fallible extends GIMarshallingTests.Object {
        vfuncVfuncMethWithErr(x) {
            seen.push(x);

            if (x === 0) {
                throw new Error("refused");
            }

            return true;
        }
    }

    const Registered = registerClass(Fallible, { typeName: uniqueName("GtkxFallible") });
    const instance = new Registered({});
    assert.equal(instance.vfuncMethWithError(1), true);
    assert.deepEqual(seen, [1]);
});

test("a vfunc that throws surfaces as an error from the C caller", () => {
    class Throwing extends GIMarshallingTests.Object {
        vfuncVfuncMethWithErr() {
            throw new Error("refused");
        }
    }

    const Registered = registerClass(Throwing, { typeName: uniqueName("GtkxThrowing") });
    assert.throws(() => new Registered({}).vfuncMethWithError(0));
});

test("a GError rethrown from a vfunc surfaces as an error from the C caller", () => {
    class Rethrowing extends GIMarshallingTests.Object {
        vfuncVfuncMethWithErr() {
            throw GIMarshallingTests.gerrorReturn();
        }
    }

    const Registered = registerClass(Rethrowing, { typeName: uniqueName("GtkxRethrowing") });
    assert.throws(() => new Registered({}).vfuncMethWithError(0));
});

test("object returning vfuncs report the ref counts their transfer annotations imply", async () => {
    const holder = { shared: null };

    class Returning extends GIMarshallingTests.Object {
        vfuncVfuncReturnObjectTransferNone() {
            return holder.shared;
        }

        vfuncVfuncOutObjectTransferNone() {
            return holder.shared;
        }

        vfuncVfuncReturnObjectTransferFull() {
            return new GIMarshallingTests.Object({ int: 4 });
        }

        vfuncVfuncOutObjectTransferFull() {
            return new GIMarshallingTests.Object({ int: 5 });
        }
    }

    const Registered = registerClass(Returning, { typeName: uniqueName("GtkxObjectReturning") });
    const instance = new Registered({});
    holder.shared = new GIMarshallingTests.Object({ int: 3 });

    assert.deepEqual(instance.getRefInfoForVfuncReturnObjectTransferNone(), [1, false]);
    assert.deepEqual(instance.getRefInfoForVfuncOutObjectTransferNone(), [1, false]);
    assert.deepEqual(instance.getRefInfoForVfuncReturnObjectTransferFull(), [2, false]);
    assert.deepEqual(instance.getRefInfoForVfuncOutObjectTransferFull(), [2, false]);
    assert.equal(holder.shared.int, 3);
    holder.shared = null;
    await drainGC();
});

test("objects passed into a vfunc arrive as wrappers of their registered class", () => {
    const seen = [];

    class Claiming extends GIMarshallingTests.Object {
        vfuncVfuncInObjectTransferNone(object) {
            seen.push(["none", object instanceof Claiming, object === this, object.int]);
        }

        vfuncVfuncInObjectTransferFull(object) {
            seen.push(["full", object instanceof Claiming, object === this, object.int]);
        }
    }

    const Registered = registerClass(Claiming, { typeName: uniqueName("GtkxClaiming") });
    const instance = new Registered({});

    assert.deepEqual(instance.getRefInfoForVfuncInObjectTransferNone(Registered), [2, false]);
    assert.deepEqual(instance.getRefInfoForVfuncInObjectTransferFull(Registered), [1, false]);
    assert.deepEqual(seen, [
        ["none", true, false, 0],
        ["full", true, false, 0],
    ]);

    assert.deepEqual(instance.getRefInfoForVfuncInObjectTransferNone(GIMarshallingTests.Object), [2, false]);
    assert.equal(seen.length, 3);
    assert.deepEqual(seen[2], ["none", false, false, 0]);
});

test("a static vtable slot is filled without an instance", () => {
    const anchor = new GIMarshallingTests.Object({});
    assert.equal(GIMarshallingTests.Object.vfuncStaticName(), "GIMarshallingTestsObject");
    assert.equal(anchor.int, 0);

    class StaticName extends GIMarshallingTests.Object {
        vfuncVfuncStaticName() {
            return "from-javascript";
        }
    }

    const Registered = registerClass(StaticName, { typeName: uniqueName("GtkxStaticName") });
    const instance = new Registered({});
    assert.ok(instance instanceof StaticName);
    assert.equal(GIMarshallingTests.Object.vfuncStaticTypedName(Registered), "from-javascript");
    assert.equal(GIMarshallingTests.Object.vfuncStaticTypedName(GIMarshallingTests.Object), "GIMarshallingTestsObject");
});

test("an interface filled by a registered class is dispatched from C", async () => {
    const seen = [];
    const holder = { instance: null };

    class Speaker extends GObject.Object {
        vfuncTestInt8In(in_) {
            seen.push([in_, this === holder.instance]);
        }
    }

    const Registered = registerClass(Speaker, {
        typeName: uniqueName("GtkxSpeaker"),
        implements: [GIMarshallingTests.Interface],
    });

    const instance = new Registered({});
    holder.instance = instance;
    assert.ok(instance instanceof GIMarshallingTests.Interface);
    assert.ok(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface)));

    GIMarshallingTests.testInterfaceTestInt8In(instance, 42);
    instance.testInt8In(-7);
    assert.deepEqual(seen, [
        [42, true],
        [-7, true],
    ]);
    holder.instance = null;
    await drainGC();
});

test("a second interface with the same slot name is adopted alongside the first", () => {
    const seen = [];

    class Pair extends GObject.Object {
        vfuncTestInt8In(in_) {
            seen.push(in_);
        }
    }

    const Registered = registerClass(Pair, {
        typeName: uniqueName("GtkxPair"),
        implements: [GIMarshallingTests.Interface, GIMarshallingTests.Interface2],
    });

    const instance = new Registered({});
    assert.ok(instance instanceof GIMarshallingTests.Interface);
    assert.ok(instance instanceof GIMarshallingTests.Interface2);
    assert.ok(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface2)));

    GIMarshallingTests.testInterfaceTestInt8In(instance, 11);
    assert.deepEqual(seen, [11]);
});

test("an interface slot taking a variant array is dispatched from C", () => {
    const seen = [];

    class Collector extends GObject.Object {
        vfuncTestVariantArrayIn(in_, nIn) {
            seen.push([in_.map((variant) => variant.getInt32()), nIn]);
        }
    }

    const Registered = registerClass(Collector, {
        typeName: uniqueName("GtkxCollector"),
        implements: [GIMarshallingTests.Interface3],
    });

    const instance = new Registered({});
    instance.testVariantArrayIn([GLib.Variant.newInt32(1), GLib.Variant.newInt32(2)]);
    assert.deepEqual(seen, [[[1, 2], 2]]);

    instance.testVariantArrayIn([]);
    assert.deepEqual(seen[1], [[], 0]);
});

test("a class adopting no slot keeps the interface default implementation", () => {
    class Silent extends GObject.Object {}

    const Registered = registerClass(Silent, {
        typeName: uniqueName("GtkxSilent"),
        implements: [GIMarshallingTests.Interface2],
    });

    const instance = new Registered({});
    assert.ok(instance instanceof GIMarshallingTests.Interface2);
    assert.equal(typeIsA(getInstanceType(instance), getClassType(GIMarshallingTests.Interface)), false);
});

test("the C interface implementation dispatches through the same interface surface", () => {
    const impl = new GIMarshallingTests.InterfaceImpl({});
    assert.ok(impl instanceof GIMarshallingTests.Interface);
    assert.equal(impl.getAsInterface(), impl);
    impl.testInt8In(42);
    GIMarshallingTests.testInterfaceTestInt8In(impl, 42);
    assert.equal(impl.getAsInterface(), impl.getAsInterface());
});

test("registerClass installs declared properties with generated and custom accessors", () => {
    class Bag extends GObject.Object {
        get doubled() {
            return this.doubledStorage ?? 0;
        }

        set doubled(value) {
            this.doubledStorage = value * 2;
        }
    }

    const Registered = registerClass(Bag, {
        typeName: uniqueName("GtkxBag"),
        properties: {
            plain: GObject.paramSpecInt("plain", null, null, 0, 100, 5, READWRITE),
            doubled: GObject.paramSpecInt("doubled", null, null, 0, 100, 0, READWRITE),
            label: GObject.paramSpecString("label", null, null, "hi", READWRITE),
        },
    });

    const instance = new Registered({});
    assert.equal(instance.plain, 5);
    assert.equal(instance.label, "hi");
    assert.equal(instance.doubled, 0);

    instance.plain = 9;
    instance.label = "there";
    instance.doubled = 4;
    assert.equal(instance.plain, 9);
    assert.equal(instance.label, "there");
    assert.equal(instance.doubled, 8);

    const constructed = new Registered({ plain: 11, label: "bye", doubled: 3 });
    assert.equal(constructed.plain, 11);
    assert.equal(constructed.label, "bye");
    assert.equal(constructed.doubled, 6);

    const value = new GObject.Value();
    value.init(GObject.typeFromName("gint"));
    instance.getProperty("doubled", value);
    assert.equal(value.getInt(), 8);
    instance.getProperty("plain", value);
    assert.equal(value.getInt(), 9);

    const notified = [];
    const id = instance.connect("notify::plain", (pspec) => {
        notified.push(pspec.getName());
    });
    instance.plain = 12;
    instance.plain = 12;
    assert.equal(instance.plain, 12);
    assert.deepEqual(notified, ["plain"]);
    GObject.signalHandlerDisconnect(instance, id);
});

test("registerClass creates declared signals that connect emit and run their default handler", () => {
    const defaults = [];

    class Pinger extends GObject.Object {
        onPinged(text) {
            defaults.push(text);

            return text.length;
        }
    }

    const Registered = registerClass(Pinger, {
        typeName: uniqueName("GtkxPinger"),
        signals: {
            pinged: {
                flags: GObject.SignalFlags.RUN_LAST,
                paramTypes: [GObject.TYPE_STRING],
                returnType: GObject.TYPE_INT,
            },
            quiet: {},
            data_changed: { paramTypes: [GObject.TYPE_INT] },
        },
    });

    const instance = new Registered({});
    const handled = [];
    instance.connect("pinged", (text) => {
        handled.push(text);

        return 99;
    });

    assert.equal(instance.emit("pinged", "abc"), 3);
    assert.deepEqual(handled, ["abc"]);
    assert.deepEqual(defaults, ["abc"]);

    assert.equal(instance.emit("quiet"), undefined);

    const dashed = [];
    instance.connect("data-changed", (count) => {
        dashed.push(count);
    });
    instance.emit("data_changed", 7);
    instance.emit("data-changed", 8);
    assert.deepEqual(dashed, [7, 8]);
});

test("declared signals reject emissions their parameter types cannot hold", () => {
    class Strict extends GObject.Object {}

    const Registered = registerClass(Strict, {
        typeName: uniqueName("GtkxStrict"),
        signals: { tagged: { paramTypes: [GObject.TYPE_INT] } },
        properties: { count: GObject.paramSpecInt("count", null, null, 0, 10, 0, READWRITE) },
    });

    assert.equal(new Registered({}).count, 0);
    assert.throws(() => new Registered({}).emit("tagged", "nope"));
    assert.throws(() => new Registered({}).emit("tagged"));
    assert.throws(() => new Registered({}).emit("tagged", 1, 2));
    assert.throws(() => new Registered({}).emit("missing", 1));
    assert.throws(() => {
        new Registered({}).count = 99;
    });
    assert.throws(() => {
        new Registered({}).count = "nope";
    });
    assert.throws(() => new Registered({ count: 99 }));
});

test("an AsyncInitable registered from JavaScript resolves through its callback", async () => {
    const seen = [];

    class EagerInit extends GObject.Object {
        vfuncInitAsync(ioPriority, cancellable, callback) {
            seen.push([ioPriority, cancellable, typeof callback]);
            const task = Gio.Task.new(this, cancellable, null);
            task.returnBoolean(true);
            callback?.(this, task, null);
        }
    }

    const Registered = registerClass(EagerInit, {
        typeName: uniqueName("GtkxEagerInit"),
        implements: [Gio.AsyncInitable],
    });

    const instance = new Registered({});
    assert.ok(instance instanceof Gio.AsyncInitable);
    assert.equal(await instance.initAsync(7), true);
    assert.deepEqual(seen, [[7, null, "function"]]);
    await drainGC();
});

test("an AsyncInitable callback captured by the vfunc completes the pending init later", async () => {
    const captured = [];
    const Registered = registerDeferredInitable(uniqueName("GtkxDeferredInit"), captured);
    const instance = new Registered({});
    const pending = instance.initAsync(0);
    assert.equal(captured.length, 1);
    assert.equal(typeof captured[0], "function");

    const task = Gio.Task.new(instance, null, null);
    task.returnBoolean(true);
    captured[0](instance, task, null);
    assert.equal(await pending, true);

    instance.vfuncInitAsync(0, null, null);
    assert.equal(captured.length, 2);
    assert.equal(captured[1], null);
    captured.length = 0;
    await drainGC();
});

test("an AsyncInitable callback rejects arguments of the wrong type", async () => {
    const captured = [];
    const Registered = registerDeferredInitable(uniqueName("GtkxBadArgsInit"), captured);
    const instance = new Registered({});
    const pending = instance.initAsync(0);
    const callback = captured[0];
    const task = Gio.Task.new(instance, null, null);
    task.returnBoolean(true);

    assert.throws(() => callback("garbage", task, null));
    assert.throws(() => callback(instance, "garbage", null));

    callback(instance, task, null);
    assert.equal(await pending, true);
    assert.throws(() => callback(instance, task, null));
    captured.length = 0;
    await drainGC();
});

test("registerClass refuses classes it cannot derive a GType from", () => {
    class Bare {
        tag = "bare";
    }

    assert.throws(() => registerClass(Bare, { typeName: uniqueName("GtkxBare") }));
    assert.throws(() => registerClass({}, { typeName: uniqueName("GtkxPlain") }));

    class Short extends GObject.Object {}

    assert.throws(() => registerClass(Short, { typeName: "x" }));

    class Punctuated extends GObject.Object {}

    assert.throws(() => registerClass(Punctuated, { typeName: "Not A Name" }));
});

test("registerClass refuses a duplicate type name", () => {
    const shared = uniqueName("GtkxDuplicate");

    class First extends GObject.Object {}
    class Second extends GObject.Object {}

    registerClass(First, { typeName: shared });
    assert.throws(() => registerClass(Second, { typeName: shared }));
});

test("registerClass refuses vfunc methods and interfaces it cannot place", () => {
    class Unknown extends GObject.Object {
        vfuncNotASlot() {
            return 0;
        }
    }

    assert.throws(() => registerClass(Unknown, { typeName: uniqueName("GtkxUnknownSlot") }));

    class NotAnInterface extends GObject.Object {}

    assert.throws(() =>
        registerClass(NotAnInterface, {
            typeName: uniqueName("GtkxNotAnInterface"),
            implements: [GObject.Object],
        }));

    class Uninitialized extends GObject.Object {}

    assert.throws(() =>
        registerClass(Uninitialized, {
            typeName: uniqueName("GtkxUninitialized"),
            implements: [Gio.AsyncInitable],
        }));

    class MismatchedProperty extends GObject.Object {}

    assert.throws(() =>
        registerClass(MismatchedProperty, {
            typeName: uniqueName("GtkxMismatched"),
            properties: { alpha: GObject.paramSpecInt("beta", null, null, 0, 10, 0, READWRITE) },
        }));

    class UppercaseSignal extends GObject.Object {}

    assert.throws(() =>
        registerClass(UppercaseSignal, {
            typeName: uniqueName("GtkxUppercaseSignal"),
            signals: { myThing: {} },
        }));

    class CssNamed extends GObject.Object {}

    assert.throws(() =>
        registerClass(CssNamed, { typeName: uniqueName("GtkxCssNamed"), cssName: "thing" }));
});

test("an abstract registered class cannot be constructed but still serves as a parent", () => {
    const seen = [];

    class AbstractBase extends GIMarshallingTests.Object {
        vfuncMethodInt8In(in_) {
            seen.push(in_);
        }
    }

    const Abstract = registerClass(AbstractBase, {
        typeName: uniqueName("GtkxAbstractBase"),
        abstract: true,
    });

    assert.throws(() => new Abstract({}));

    class Concrete extends AbstractBase {}

    const Registered = registerClass(Concrete, { typeName: uniqueName("GtkxConcrete") });
    const instance = new Registered({});
    instance.methodInt8In(21);
    assert.deepEqual(seen, [21]);
});
