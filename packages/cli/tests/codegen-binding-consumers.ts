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
            "fields.ts": `import { Node, Plain, type Iface } from "@gtkx/gi/recordfields";
export const node = new Node({ refCount: 2 });
node.refCount = 3;
export const refCount: number = node.refCount;
export const interfaces: Iface[] = node.interfaces;
export const plain = new Plain({ value: 4 });
plain.value = 5;
export const value: number = plain.value;
`,
            "registered-type.ts": `import type { Value } from "@gtkx/gi/gobject";
import { Provider } from "@gtkx/gi/recordfields";
export const initialize = (value: Value): void => { value.init(Provider); };
`,
        },
        rejected: {
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
            "inline-fields.ts": `import { Corner, Frame, Span } from "@gtkx/gi/inlinearray";
export const frame = new Frame();
frame.axes = [1, 2, 3, 4];
frame.axes = [];
frame.corners = [new Corner({ width: 1, height: 2 })];
frame.spans = [new Span({ start: 1, stop: 2 })];
export const axes: number[] = frame.axes;
export const corners: Corner[] = frame.corners;
export const spans: Span[] = frame.spans;
for (const corner of corners) { corner.scale(2); }
export const names: string[] = frame.names;
export const buffer: number[] = frame.buffer;
`,
            "sized-records.ts": `import { type Chain, Span } from "@gtkx/gi/inlinearray";
export const update = (chain: Chain): Span[] => {
    chain.links = [new Span({ start: 1, stop: 2 })];
    return chain.links;
};
`,
            "resource-records.ts": `import type { Chain, TextSpan } from "@gtkx/gi/inlinearray";
export const read = (chain: Chain): TextSpan[] => chain.textLinks;
`,
        },
        rejected: {
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
            "resource-record-write.ts": `import type { Chain } from "@gtkx/gi/inlinearray";
export const update = (chain: Chain): void => { chain.textLinks = chain.textLinks; };
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
