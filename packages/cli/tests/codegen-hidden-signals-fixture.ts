import { readFileSync } from "node:fs";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.hiddensignals",
    libraries: ["SignalPointers-1.0", "WebKit-6.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const IMPORTS = `import * as SignalPointers from "@gtkx/gi/signalpointers";
import * as GObject from "@gtkx/gi/gobject";
import * as Gio from "@gtkx/gi/gio";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Soup from "@gtkx/gi/soup";
import * as WebKit from "@gtkx/gi/webkit";
import { SignalPointersProbe, SignalPointersChild, type SignalPointersFeedProps } from "@gtkx/jsx/signalpointers";
import type { WebKitBackForwardListProps } from "@gtkx/jsx/webkit";
import type { GtkTreeModelProps } from "@gtkx/jsx/gtk";
import type { GApplicationProps, GSettingsProps } from "@gtkx/jsx/gio";
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
const opened = (files: Gio.File[], count: number, hint: string) => {
    return { files, count, hint };
};
const changed = (keys: GLib.Quark[] | Uint32Array | null, count: number): boolean => {
    return keys === null || keys.length === count;
};
export const applicationProps: GApplicationProps = { onOpen: opened };
export const settingsProps: GSettingsProps = { onChangeEvent: changed };
export const containerSignals = (
    application: Gio.Application, settings: Gio.Settings, mount: Gio.MountOperation, message: Soup.Message,
) => {
    application.connect("open", opened);
    application.on("open", opened);
    settings.connect("change-event", changed);
    settings.on("change-event", changed);
    mount.emit("ask-question", "Choose", ["Continue"]);
    mount.emit("show-processes", "Busy", [1], ["Cancel"]);
    message.emit("content-sniffed", "text/plain", new Map([["charset", "utf-8"]]));
};
`;
const REJECTED = {
    "fixed-array-emit": "export const emit = (probe: SignalPointers.Probe) => probe.emit(\"array\", [1, 2]);",
    "application-array-emit": "export const emit = (application: Gio.Application) => " +
        "application.emit(\"open\", [], 0, \"\");",
    "settings-array-emit": "export const emit = (settings: Gio.Settings) => " +
        "settings.emit(\"change-event\", null, 0);",
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
} as const;

type RejectedName = keyof typeof REJECTED;

const createHiddenSignalsProject = (
    prefix: string,
    acceptedFiles: Record<string, string>,
    rejectedNames: readonly RejectedName[] = [],
): ReturnType<typeof createCliProject> => {
    const fixture = readFileSync(new URL("fixtures/gir/SignalPointers-1.0.gir", import.meta.url));
    const rejectedFiles = Object.fromEntries(rejectedNames.map((name) => [
        name + ".tsx",
        IMPORTS + REJECTED[name],
    ]));
    const project = createCliProject({
        prefix,
        config: CONFIG,
        files: {
            "gir/SignalPointers-1.0.gir": fixture,
            ...acceptedFiles,
            ...rejectedFiles,
        },
    });

    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);

    return project;
};

export { ACCEPTED, createHiddenSignalsProject, type RejectedName };
