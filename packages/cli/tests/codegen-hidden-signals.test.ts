import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer, typecheckFile } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.hiddensignals",
    libraries: ["SignalPointers-1.0", "WebKit-6.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as SignalPointers from "@gtkx/gi/signalpointers";
import * as GObject from "@gtkx/gi/gobject";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Soup from "@gtkx/gi/soup";
import * as WebKit from "@gtkx/gi/webkit";
import { SignalPointersProbe, SignalPointersChild, type SignalPointersFeedProps } from "@gtkx/jsx/signalpointers";
import type { WebKitBackForwardListProps } from "@gtkx/jsx/webkit";
import type { GtkTreeModelProps } from "@gtkx/jsx/gtk";
`;
const ACCEPTED = IMPORTS + `
export const connect = (probe: SignalPointers.Probe, child: SignalPointers.Child, feed: SignalPointers.Feed) => {
    probe.connect("object", (item: GObject.Object) => { void item; });
    probe.connect("boxed", (iter: Gtk.TextIter) => { void iter; });
    probe.connect("bytes", (bytes: GLib.Bytes) => { void bytes; });
    probe.connect("byte-array", (bytes: Uint8Array) => { void bytes; });
    probe.connect("integer", (data: bigint) => { void data; });
    probe.connect("array", (values: number[]) => { void values; });
    probe.connect("closure", (closure: GObject.Closure) => { void closure; });
    feed.connect("iface-safe", (item: GObject.Object) => { void item; });
    child.connect("shared", (count: bigint) => count > 0n);
    const shared: boolean = probe.emit("shared", 1n);
    child.emit("integer", 2n);
    probe.emit("array", [1, 2]);
    const integerArgs: Parameters<SignalPointers.ProbeSignals["integer"]> = [1n];
    const sharedArgs: Parameters<SignalPointers.FeedSignals["shared"]> = [2n];
    const predicate: SignalPointers.Predicate = (count) => count > 0;
    return { shared, integerArgs, sharedArgs, predicate };
};
export const views = [
    <SignalPointersProbe onInteger={(data: bigint) => { void data; }} onShared={(count) => count > 0n} />,
    <SignalPointersChild revision={1} onIfaceSafe={(item: GObject.Object) => { void item; }} />,
];
export const feedProps: SignalPointersFeedProps = { onShared: (count) => count > 0n };
export const supported = (
    buffer: Gtk.TextBuffer, socket: Soup.WebsocketConnection, history: WebKit.BackForwardList,
) => {
    buffer.connect("insert-child-anchor", (iter: Gtk.TextIter, anchor: Gtk.TextChildAnchor) => {
        void iter;
        void anchor;
    });
    socket.connect("message", (kind: number, bytes: GLib.Bytes) => {
        void kind;
        void bytes;
    });
    socket.connect("error", (error: GLib.Error) => { void error; });
    const historyProps: WebKitBackForwardListProps = {};
    const treeProps: GtkTreeModelProps = { onRowChanged: (path: Gtk.TreePath, iter: Gtk.TreeIter) => {
        void path;
        void iter;
    } };
    return { length: history.getLength(), historyProps, treeProps };
};
`;
const REJECTED: Record<string, string> = {
    "direct-connect": "export const connect = (probe: SignalPointers.Probe) => " +
        "probe.connect(\"direct\", () => undefined);",
    "direct-emit": "export const emit = (probe: SignalPointers.Probe) => probe.emit(\"direct\", 0n);",
    "named-data-jsx": "export const view = <SignalPointersProbe onNamedData={() => undefined} />;",
    "aliased-handler": "export type Handler = SignalPointers.ProbeSignals[\"alias\"];",
    "nested-handler": "export type Handler = SignalPointers.ProbeSignals[\"nested\"];",
    "out-pointer": "export type Handler = SignalPointers.ProbeSignals[\"out-pointer\"];",
    "return-pointer": "export type Handler = SignalPointers.ProbeSignals[\"return-pointer\"];",
    "skipped-return": "export type Handler = SignalPointers.ProbeSignals[\"skipped-return\"];",
    "unknown-array": "export const view = <SignalPointersProbe onUnknownArray={() => undefined} />;",
    "callback-value": "export type Handler = SignalPointers.ProbeSignals[\"callback-value\"];",
    "private-jsx": "export const view = <SignalPointersProbe onPrivateSignal={() => undefined} />;",
    "interface-connect": "export const connect = (feed: SignalPointers.Feed) => " +
        "feed.connect(\"iface-raw\", () => undefined);",
    "interface-props": "export const props: SignalPointersFeedProps = { onIfaceRaw: () => undefined };",
    "interface-private": "export const props: SignalPointersFeedProps = { onIfacePrivate: () => undefined };",
    "inherited-emit": "export const emit = (child: SignalPointers.Child) => child.emit(\"iface-raw\", 0n);",
    "inherited-private": "export const view = <SignalPointersChild onIfacePrivate={() => undefined} />;",
    "webkit-connect": "export const connect = (history: WebKit.BackForwardList) => " +
        "history.connect(\"changed\", () => undefined);",
    "webkit-emit": "export const emit = (history: WebKit.BackForwardList) => history.emit(\"changed\", null, 0n);",
    "webkit-jsx": "export const props: WebKitBackForwardListProps = { onChanged: () => undefined };",
    "tree-model-jsx": "export const props: GtkTreeModelProps = { onRowsReordered: () => undefined };",
    "tree-model-map": "export type Handler = Gtk.TreeModelSignals[\"rows-reordered\"];",
};
const rejectedFiles = Object.fromEntries(Object.entries(REJECTED).map(([name, source]) => [
    `${name}.tsx`, IMPORTS + source,
]));
const OMITTED_SIGNALS = [
    ["direct", "onDirect"],
    ["named-data", "onNamedData"],
    ["alias", "onAlias"],
    ["nested", "onNested"],
    ["out-pointer", "onOutPointer"],
    ["return-pointer", "onReturnPointer"],
    ["skipped-return", "onSkippedReturn"],
    ["unknown-array", "onUnknownArray"],
    ["callback-value", "onCallbackValue"],
    ["private-signal", "onPrivateSignal"],
    ["iface-raw", "onIfaceRaw"],
    ["iface-private", "onIfacePrivate"],
] as const;

describe("generated unsupported signal omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        const fixture = readFileSync(new URL("fixtures/gir/SignalPointers-1.0.gir", import.meta.url));
        project = cleanup.use(createCliProject({
            prefix: "gtkx-cli-hidden-signal-types-",
            config: CONFIG,
            files: { "gir/SignalPointers-1.0.gir": fixture, "accepted.tsx": ACCEPTED, ...rejectedFiles },
        }));
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        reference = loadApiReference({
            libraries: ["SignalPointers-1.0", "Gtk-4.0", "WebKit-6.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves typed handles, boxed bytes, real integers, arrays and supported interface signals", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
    });

    it.each(Object.keys(REJECTED))("rejects the omitted public signal in %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
    });

    it("aligns class, interface and JSX reference signals while preserving owner precedence", () => {
        const probe = reference.lookup("SignalPointers.Probe", "class");
        const element = reference.lookup("SignalPointersProbe", "element");
        const feed = reference.lookup("SignalPointers.Feed", "interface");
        expect(probe.outcome).toBe("page");
        expect(element.outcome).toBe("page");
        expect(feed.outcome).toBe("page");
        for (const name of [
            "object", "boxed", "bytes", "byte-array", "integer", "array", "closure", "shared", "iface-safe",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const [signal, prop] of OMITTED_SIGNALS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${signal}\``));
            expect(element).toHaveProperty("markdown", expect.not.stringContaining(`### \`${prop}\``));
        }
        for (const name of ["onInteger", "onShared", "onIfaceSafe"]) {
            expect(element).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        expect(probe).toHaveProperty("markdown", expect.stringContaining("ownerCount: bigint"));
        expect(probe).toHaveProperty("markdown", expect.not.stringContaining("interfaceCount: bigint"));
        expect(feed).toHaveProperty("markdown", expect.stringContaining("interfaceCount: bigint"));
        for (const name of ["iface-raw", "iface-private"]) {
            expect(feed).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(reference.lookup("SignalPointers.Predicate", "callback").outcome).toBe("page");
    });

    it("omits the installed WebKit pointer signal and non-introspectable TreeModel signal", () => {
        const history = reference.lookup("WebKit.BackForwardList", "class");
        const historyElement = reference.lookup("WebKitBackForwardList", "element");
        const treeModel = reference.lookup("Gtk.TreeModel", "interface");
        const sortedModel = reference.lookup("GtkTreeModelSort", "element");
        expect(history.outcome).toBe("page");
        expect(historyElement.outcome).toBe("page");
        expect(treeModel.outcome).toBe("page");
        expect(sortedModel.outcome).toBe("page");
        expect(history).toHaveProperty("markdown", expect.stringContaining("### `getLength`"));
        expect(history).toHaveProperty("markdown", expect.not.stringContaining("### `changed`"));
        expect(historyElement).toHaveProperty("markdown", expect.not.stringContaining("### `onChanged`"));
        expect(treeModel).toHaveProperty("markdown", expect.stringContaining("### `row-changed`"));
        expect(treeModel).toHaveProperty("markdown", expect.not.stringContaining("### `rows-reordered`"));
        expect(sortedModel).toHaveProperty("markdown", expect.stringContaining("### `onRowChanged`"));
        expect(sortedModel).toHaveProperty("markdown", expect.not.stringContaining("### `onRowsReordered`"));
    });
});
