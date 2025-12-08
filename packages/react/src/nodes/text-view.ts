import { createRef } from "@gtkx/ffi";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../factory.js";
import { Node } from "../node.js";

type OnChangedHandler = (text: string) => void;

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();
    const startRef = createRef(startIter.ptr);
    const endRef = createRef(endIter.ptr);
    buffer.getStartIter(startRef);
    buffer.getEndIter(endRef);
    return buffer.getText(startIter, endIter, true);
};

const setBufferText = (buffer: Gtk.TextBuffer, text: string): void => {
    buffer.setText(text, -1);
};

export class TextViewNode extends Node<Gtk.TextView> {
    static override matches(type: string): boolean {
        return type === "TextView";
    }

    private buffer: Gtk.TextBuffer;
    private onChanged?: OnChangedHandler;
    private bufferChangedHandlerId?: number;

    constructor(type: string, props: Props) {
        super(type, props);

        this.buffer = this.widget.getBuffer();
        this.onChanged = props.onChanged as OnChangedHandler | undefined;

        if (typeof props.text === "string") {
            setBufferText(this.buffer, props.text);
        }

        // Connect after a microtask to avoid signal firing during widget construction
        queueMicrotask(() => this.connectBufferSignal());
    }

    private connectBufferSignal(): void {
        if (this.onChanged && this.bufferChangedHandlerId === undefined) {
            this.bufferChangedHandlerId = this.buffer.connect("changed", () => {
                const text = getBufferText(this.buffer);
                this.onChanged?.(text);
            });
        }
    }

    private disconnectBufferSignal(): void {
        if (this.bufferChangedHandlerId !== undefined) {
            GObject.signalHandlerDisconnect(this.buffer, this.bufferChangedHandlerId);
            this.bufferChangedHandlerId = undefined;
        }
    }

    protected override consumedProps(): Set<string> {
        const consumed = super.consumedProps();
        consumed.add("text");
        consumed.add("onChanged");
        return consumed;
    }

    override updateProps(oldProps: Props, newProps: Props): void {
        if (this.buffer && oldProps.onChanged !== newProps.onChanged) {
            this.disconnectBufferSignal();
            this.onChanged = newProps.onChanged as OnChangedHandler | undefined;
            this.connectBufferSignal();
        }

        if (this.buffer && oldProps.text !== newProps.text && typeof newProps.text === "string") {
            const currentText = getBufferText(this.buffer);
            if (currentText !== newProps.text) {
                setBufferText(this.buffer, newProps.text);
            }
        }

        super.updateProps(oldProps, newProps);
    }
}
