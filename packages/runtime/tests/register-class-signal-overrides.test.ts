import * as Gio from "@gtkx/gi/gio";
import {
    Object as GObject,
    ParamFlags,
    type ParamSpec,
    paramSpecString,
    SignalFlags,
} from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { registerClass, TYPE_INT, TYPE_OBJECT, TYPE_STRING } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";
import { createTypeNameFactory } from "./helpers/unique-name.js";

const uniqueName = createTypeNameFactory("_");
const DEFAULT_ANSWER = 79;

const makeBeaconClass = () => {
    class Beacon extends GObject {
        seen: [string, number][] = [];

        onDataChanged(text: string, count: number): void {
            this.seen.push([text, count]);
        }
    }

    return registerClass(Beacon, {
        typeName: uniqueName("GtkxOnSignalBeacon"),
        signals: { "data-changed": { paramTypes: [TYPE_STRING, TYPE_INT] } },
    });
};

const makeReplierClass = () => {
    class Replier extends GObject {
        order: string[] = [];

        onFull(): number {
            this.order.push("default");

            return DEFAULT_ANSWER;
        }
    }

    return registerClass(Replier, {
        typeName: uniqueName("GtkxOnSignalReplier"),
        signals: { full: { flags: SignalFlags.RUN_LAST, returnType: TYPE_INT } },
    });
};

const makeWatcherClass = () => {
    class Watcher extends GObject {
        declare nickname: string;
        notified: string[] = [];

        onNotify(pspec: ParamSpec): void {
            this.notified.push(pspec.getName());
        }
    }

    return registerClass(Watcher, {
        typeName: uniqueName("GtkxOnSignalWatcher"),
        properties: { nickname: paramSpecString("nickname", null, null, "", ParamFlags.READWRITE) },
    });
};

const makePingerClasses = () => {
    class BasePinger extends GObject {
        log: string[] = [];

        onPing(): void {
            this.log.push("base");
        }
    }

    const RegisteredBase = registerClass(BasePinger, {
        typeName: uniqueName("GtkxOnSignalChainBase"),
        signals: { ping: {} },
    });

    class SubPinger extends RegisteredBase {
        override onPing(): void {
            super.onPing();
            this.log.push("sub");
        }
    }

    registerClass(SubPinger, { typeName: uniqueName("GtkxOnSignalChainSub") });

    return { RegisteredBase, SubPinger };
};

const makeFeedClass = () => {
    class Feed extends GObject implements Gio.ListModelImpl {
        changes: [number, number, number][] = [];

        vfuncGetItemType(): bigint {
            return TYPE_OBJECT;
        }

        vfuncGetNItems(): number {
            return 0;
        }

        vfuncGetItem(): GObject | null {
            return null;
        }

        onItemsChanged(position: number, removed: number, added: number): void {
            this.changes.push([position, removed, added]);
        }
    }

    registerClass(Feed, { typeName: uniqueName("GtkxOnSignalFeed"), implements: [Gio.ListModel] });

    return Feed;
};

describe("registerClass — on<SignalName> default handlers", () => {
    it("installs an on<SignalName> method as the declared signal's default handler", () => {
        const Beacon = makeBeaconClass();
        const instance = new Beacon();
        instance.emit("data-changed", "hello", 3);
        expect(instance.seen).toEqual([["hello", 3]]);
    });

    it("runs the default handler in the flags' stage and keeps its return value", () => {
        const Replier = makeReplierClass();
        const instance = new Replier();

        instance.connect("full", () => {
            instance.order.push("handler");

            return 3;
        });

        expect(instance.emit("full")).toBe(DEFAULT_ANSWER);
        expect(instance.order).toEqual(["handler", "default"]);
    });

    it("overrides an inherited Gtk signal's default handler", () => {
        class Clicker extends Gtk.Button {
            clicks = 0;

            onClicked(): void {
                this.clicks += 1;
            }
        }

        const Registered = registerClass(Clicker, { typeName: uniqueName("GtkxOnSignalClicker") });
        const button = new Registered();
        button.emit("clicked");
        expect(button.clicks).toBe(1);
    });

    it("delivers property notifications to onNotify alongside connected listeners", () => {
        const Watcher = makeWatcherClass();
        const instance = new Watcher();
        const listened: string[] = [];

        instance.connect("notify::nickname", (pspec: ParamSpec) => {
            listened.push(pspec.getName());
        });

        instance.nickname = "pat";
        expect(instance.notified).toEqual(["nickname"]);
        expect(listened).toEqual(["nickname"]);
    });

    it("lets a subclass replace the handler and chain up through super", () => {
        const { RegisteredBase, SubPinger } = makePingerClasses();
        const sub = new SubPinger();
        sub.emit("ping");
        expect(sub.log).toEqual(["base", "sub"]);
        const base = new RegisteredBase();
        base.emit("ping");
        expect(base.log).toEqual(["base"]);
    });
});

describe("registerClass — on<SignalName> edge cases", () => {
    it("installs the default handler for a signal an implemented interface carries", () => {
        const Feed = makeFeedClass();
        const feed = new Feed() as InstanceType<typeof Feed> & Gio.ListModel;
        feed.itemsChanged(1, 0, 2);
        expect(feed.changes).toEqual([[1, 0, 2]]);
    });

    it("leaves an on-prefixed method naming no signal as the ordinary method it is", () => {
        class Quiet extends GObject {
            polls = 0;

            onFrobnicate(): string {
                this.polls += 1;

                return "plain";
            }
        }

        const Registered = registerClass(Quiet, { typeName: uniqueName("GtkxOnSignalQuiet") });
        const instance = new Registered();
        expect(instance.onFrobnicate()).toBe("plain");
        expect(instance.polls).toBe(1);
    });
});

describe("registerClass — on<SignalName> error paths", () => {
    it("propagates what the default handler throws out of the emission", () => {
        class Volatile extends GObject {
            onBoom(): void {
                throw new Error("boom");
            }
        }

        const Registered = registerClass(Volatile, {
            typeName: uniqueName("GtkxOnSignalVolatile"),
            signals: { boom: {} },
        });

        const instance = new Registered();

        expect(() => {
            instance.emit("boom");
        }).toThrow();
    });
});
