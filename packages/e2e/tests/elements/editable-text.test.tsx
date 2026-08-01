import type * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkEntryBuffer } from "@gtkx/jsx/gtk";
import { render, userEvent } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";

type TextProps = (text: string) => { text: string } | { buffer: ReactElement };
type ControlledEntryProps = { entryRef: RefObject<Gtk.Entry | null>; initial: string; textProps: TextProps };

const CARRIERS: [string, TextProps][] = [["text prop", directText], ["entry buffer", bufferedText]];

function directText(text: string): { text: string } {
    return { text };
}

function bufferedText(text: string): { buffer: ReactElement } {
    return { buffer: <GtkEntryBuffer text={text} /> };
}

const readInto = (setText: (value: string) => void) => (entry: Gtk.Entry) => {
    setText(entry.getText());
};

const requireEntry = (entryRef: RefObject<Gtk.Entry | null>): Gtk.Entry => {
    const entry = entryRef.current;

    if (entry === null) {
        throw new Error("Expected the GtkEntry to be assigned");
    }

    return entry;
};

const ControlledEntry = ({ entryRef, initial, textProps }: ControlledEntryProps) => {
    const [text, setText] = useState(initial);

    return <GtkEntry ref={entryRef} {...textProps(text)} onChanged={readInto(setText)} />;
};

const typeIntoControlled = async (textProps: TextProps): Promise<Gtk.Entry> => {
    const entryRef = createRef<Gtk.Entry>();
    await render(<ControlledEntry entryRef={entryRef} initial="ab" textProps={textProps} />);
    const entry = requireEntry(entryRef);
    await userEvent.type(entry, "c");

    return entry;
};

const rerenderUncontrolled = async (textProps: TextProps): Promise<Gtk.Entry> => {
    const entryRef = createRef<Gtk.Entry>();
    const { rerender } = await render(<GtkEntry ref={entryRef} {...textProps("one")} />);
    await rerender(<GtkEntry ref={entryRef} {...textProps("two")} />);

    return requireEntry(entryRef);
};

describe("render - controlled editable text", () => {
    it.each(CARRIERS)("leaves the caret after text typed through the %s", async (_carrier, textProps) => {
        const entry = await typeIntoControlled(textProps);
        expect(entry).toHaveObjectProperty("text", "abc");
        expect(entry.getPosition()).toBe(3);
    });

    it.each(CARRIERS)("writes %s text the widget does not already hold", async (_carrier, textProps) => {
        const entry = await rerenderUncontrolled(textProps);
        expect(entry).toHaveObjectProperty("text", "two");
    });

    it("appends successive characters typed without refocusing", async () => {
        const entry = await typeIntoControlled(directText);
        await userEvent.type(entry, "d", { shouldFocus: false });
        expect(entry).toHaveObjectProperty("text", "abcd");
    });
});
