type BindingConsumers = {
    title: string;
    library: string;
    accepted: Record<string, string>;
    rejected: Record<string, string>;
};

const BINDING_CONSUMERS: BindingConsumers[] = [
    {
        title: "names beginning with a digit",
        library: "DigitName-1.0",
        accepted: {
            "mode.ts": `import { _80211Mode, type Radio } from "@gtkx/gi/digitname";
export const modes: _80211Mode[] = [_80211Mode.UNKNOWN, _80211Mode.INFRA];
export const mode = (radio: Radio): _80211Mode => radio.getMode();
`,
        },
        rejected: {
            "mode-result.ts": `import type { Radio } from "@gtkx/gi/digitname";
export const mode = (radio: Radio): string => radio.getMode();
`,
        },
    },
    {
        title: "record fields and registered types",
        library: "RecordFields-1.0",
        accepted: {
            "fields.ts": `import { type Node, Plain, type Iface } from "@gtkx/gi/recordfields";
export const update = (node: Node): void => {
node.refCount = 3;
const refCount: number = node.refCount;
const interfaces: Iface[] = node.interfaces;
void refCount;
void interfaces;
};
export const plain = new Plain({ value: 4 });
plain.value = 5;
export const value: number = plain.value;
`,
            "registered-type.ts": `import type { Value } from "@gtkx/gi/gobject";
import { Provider } from "@gtkx/gi/recordfields";
export const initialize = (value: Value): void => { value.init(Provider); };
`,
            "simple-allocation.ts": `import * as Records from "@gtkx/gi/recordfields";
import * as GLib from "@gtkx/gi/glib";
export const nested = new Records.NestedSimple({ inner: new Records.Plain({ value: 5 }) });
export const output: Records.NestedSimple = Records.fillSimple();
export const text = GLib.String.new("hello");
text.assign("world");
export const length: number = text.len;
`,
        },
        rejected: {
            "non-simple-constructor.ts": `import { Node } from "@gtkx/gi/recordfields";
export const node = new Node({ refCount: 2 });
`,
            "private-state-constructor.ts": `import { PrivateState } from "@gtkx/gi/recordfields";
export const value = new PrivateState();
`,
            "nested-private-state-constructor.ts": `import { NestedPrivateState } from "@gtkx/gi/recordfields";
export const value = new NestedPrivateState();
`,
            "pointer-constructor.ts": `import { PlainPointers } from "@gtkx/gi/recordfields";
export const value = new PlainPointers();
`,
            "nested-pointer-constructor.ts": `import { NestedPointers } from "@gtkx/gi/recordfields";
export const value = new NestedPointers();
`,
            "pointer-output.ts": `import * as Records from "@gtkx/gi/recordfields";
export const value = Records.fillPointers();
`,
            "nested-pointer-output.ts": `import * as Records from "@gtkx/gi/recordfields";
export const value = Records.fillNestedPointers();
`,
            "string-constructor.ts": `import * as GLib from "@gtkx/gi/glib";
export const value = new GLib.String({ str: "hello" });
`,
            "string-buffer-write.ts": `import * as GLib from "@gtkx/gi/glib";
GLib.String.new("hello").str = "world";
`,
            "string-length-write.ts": `import * as GLib from "@gtkx/gi/glib";
GLib.String.new("hello").len = 0;
`,
            "string-capacity-write.ts": `import * as GLib from "@gtkx/gi/glib";
GLib.String.new("hello").allocatedLen = 0;
`,
            "array-write.ts": `import type { Node } from "@gtkx/gi/recordfields";
export const update = (node: Node): void => { node.interfaces = []; };
`,
            "array-constructor.ts": `import { Node } from "@gtkx/gi/recordfields";
export const node = new Node({ interfaces: [] });
`,
            "scalar-write.ts": `import type { Node } from "@gtkx/gi/recordfields";
export const update = (node: Node): void => { node.refCount = "three"; };
`,
            "sized-pointer-field.ts": `import type { Node } from "@gtkx/gi/recordfields";
export const entries = (node: Node) => node.entries;
`,
            "sized-pointer-constructor.ts": `import { Node } from "@gtkx/gi/recordfields";
export const node = new Node({ entries: [] });
`,
            "list-field.ts": `import type { Node } from "@gtkx/gi/recordfields";
export const links = (node: Node) => node.links;
`,
            "list-constructor.ts": `import { Node } from "@gtkx/gi/recordfields";
export const node = new Node({ links: [] });
`,
            "unregistered-type.ts": `import type { Value } from "@gtkx/gi/gobject";
import { Plain } from "@gtkx/gi/recordfields";
export const initialize = (value: Value): void => { value.init(Plain); };
`,
        },
    },
    {
        title: "inline and pointer-backed array fields",
        library: "InlineArray-1.0",
        accepted: {
            "inline-fields.ts": `import { Corner, type Frame, Span } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame) => {
frame.axes = [1, 2, 3, 4];
frame.axes = [];
frame.corners = [new Corner({ width: 1, height: 2 })];
frame.spans = [new Span({ start: 1, stop: 2 })];
const axes: number[] = frame.axes;
const corners: Corner[] = frame.corners;
const spans: Span[] = frame.spans;
for (const corner of corners) { corner.scale(2); }
const names: string[] = frame.names;
const buffer: number[] = frame.buffer;
return { axes, corners, spans, names, buffer };
};
`,
            "sized-records.ts": `import { type Chain, Span } from "@gtkx/gi/inlinearray";
export const update = (chain: Chain): Span[] => {
    chain.links = [new Span({ start: 1, stop: 2 })];
    return chain.links;
};
`,
        },
        rejected: {
            "pointer-fields-constructor.ts": `import { Frame } from "@gtkx/gi/inlinearray";
export const frame = new Frame();
`,
            "numeric-elements.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame): void => { frame.axes = ["one"]; };
`,
            "record-elements.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame): void => { frame.corners = [1]; };
`,
            "plain-record-elements.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame): void => { frame.spans = ["one"]; };
`,
            "string-pointer-write.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame): void => { frame.names = []; };
`,
            "numeric-pointer-write.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const update = (frame: Frame): void => { frame.buffer = []; };
`,
            "inline-handles.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const handles = (frame: Frame) => frame.handles;
`,
            "unsupported-records.ts": `import type { Frame } from "@gtkx/gi/inlinearray";
export const slots = (frame: Frame) => frame.slots;
`,
            "sized-record-elements.ts": `import type { Chain } from "@gtkx/gi/inlinearray";
export const update = (chain: Chain): void => { chain.links = [1]; };
`,
            "sized-record-constructor.ts": `import { Chain } from "@gtkx/gi/inlinearray";
export const chain = new Chain();
`,
        },
    },
    {
        title: "callback parameters in virtual functions",
        library: "HookSlots-1.0",
        accepted: {
            "callbacks.ts": `import { Station, type HookFunc } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    override vfuncBind(hook: HookFunc | null): void {
        if (hook !== null) { const result: boolean = hook(5); void result; }
        super.vfuncBind(hook);
    }
    bind(): void {
        this.vfuncBind((value: number): boolean => value > 0);
        this.vfuncBind(null);
    }
}
`,
            "notified.ts": `import { Station, type HookAliasChain } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    override vfuncWatch(hook: HookAliasChain | null): void {
        if (hook !== null) { const result: boolean = hook(5); void result; }
        super.vfuncWatch(hook);
        super.vfuncWatch(null);
    }
}
`,
        },
        rejected: {
            "callback-result.ts": `import { Station } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    bind(): void { super.vfuncBind(() => "true"); }
}
`,
            "notified-result.ts": `import { Station } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    watch(): void { super.vfuncWatch(() => "true"); }
}
`,
            "nonadjacent-slot.ts": `import { Station } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    deferred() { return super.vfuncDefer; }
}
`,
            "callback-return-slot.ts": `import { Station } from "@gtkx/gi/hookslots";
export class Receiver extends Station {
    callback() { return super.vfuncGetHook; }
}
`,
        },
    },
];

export { BINDING_CONSUMERS };
