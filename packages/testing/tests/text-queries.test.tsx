import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import {
    GtkBox,
    GtkEntry,
    GtkExpander,
    GtkLabel,
    GtkListBox,
    GtkTextBuffer,
    GtkTextView,
    type GtkWidgetProps,
} from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import { getWidgetText, render, screen, within } from "@gtkx/testing";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";

const LabelledField = ({ isInside, isVisible }: { isInside: boolean; isVisible: boolean }): ReactNode => {
    const [target, setTarget] = useState<Gtk.Entry | null>(null);
    const field = <GtkEntry ref={setTarget} name="field" visible={isVisible} />;

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkBox name="scope" orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel mnemonicWidget={target}>Field</GtkLabel>
                {isInside && field}
            </GtkBox>
            {!isInside && field}
        </GtkBox>
    );
};

class DrawnTextBase extends Gtk.Widget implements Gtk.AccessibleTextImpl {
    vfuncGetContents(start: number, end: number): GLib.Bytes {
        return GLib.Bytes.new(new TextEncoder().encode("Drawn reading".slice(start, end)));
    }
}

const DrawnText = registerClass(DrawnTextBase, {
    typeName: "TestingDrawnText",
    implements: [Gtk.AccessibleText],
    classInit(klass: Gtk.WidgetClass) {
        klass.setAccessibleRole(Gtk.AccessibleRole.LABEL);
    },
});

const DrawnTextElement = createElementComponent<GtkWidgetProps>("TestingDrawnText", DrawnText);

describe("rendered label text", () => {
    it("reads text that a widget exposes only through its accessible text", async () => {
        await render(
            <GtkBox>
                <DrawnTextElement name="drawn" />
                <GtkTextView name="notes" buffer={<GtkTextBuffer text="Buffered notes" />} />
                <GtkTextView name="empty" />
            </GtkBox>,
        );
        const drawn = screen.getByName("drawn");
        expect(screen.getByText("Drawn reading")).toBe(drawn);
        expect(getWidgetText(drawn)).toBe("Drawn reading");
        expect(drawn).toHaveTextContent("Drawn reading");
        expect(screen.getByName("notes")).toHaveTextContent("Buffered notes");
        expect(getWidgetText(screen.getByName("notes"))).toBe("Buffered notes");
        expect(getWidgetText(screen.getByName("empty"))).toBeNull();
    });

    it.each([
        <GtkExpander name="labelled" useMarkup useUnderline label={"<b>_Save __ &amp; close</b>"} />,
        <GtkListBox>
            <AdwActionRow name="labelled" useMarkup useUnderline title={"<b>_Save __ &amp; close</b>"} />
        </GtkListBox>,
    ])("reads rendered text from a widget with its own markup property: %s", async (element) => {
        await render(element);
        const widget = screen.getByName("labelled");
        expect(getWidgetText(widget)).toBe("Save _ & close");
        expect(widget).toHaveTextContent("Save _ & close");
        expect(screen.getByText("Save _ & close")).toHaveTextContent("Save _ & close");
    });

    it.each([
        ["<b>Save &amp; close</b>", "Save & close", false],
        ["<b>_Save __ file</b>", "Save _ file", true],
        ["<span foreground='red'>こんにちは</span>", "こんにちは", false],
    ])("queries visible text from %s", async (markup, visibleText, isUnderlineUsed) => {
        await render(<GtkLabel name="label" useMarkup useUnderline={isUnderlineUsed} label={markup} />);
        const label = screen.getByName("label");
        expect(screen.getByText(visibleText)).toBe(label);
        expect(screen.getByRole(Gtk.AccessibleRole.LABEL, { name: visibleText })).toBe(label);
        expect(getWidgetText(label)).toBe(visibleText);
        expect(label).toHaveTextContent(visibleText);
        expect(label).toHaveAccessibleName(visibleText);
        expect(screen.queryByText(markup)).toBeNull();
    });

    it("preserves literal markup when markup interpretation is disabled", async () => {
        await render(<GtkLabel label="<b>Literal</b>" />);
        expect(screen.getByText("<b>Literal</b>")).toHaveTextContent("<b>Literal</b>");
        expect(screen.queryByText("Literal")).toBeNull();
    });
});

describe("mnemonic query scope", () => {
    it("keeps a mnemonic target outside the container out of scoped queries", async () => {
        await render(<LabelledField isInside={false} isVisible />);
        expect(screen.getByLabelText("Field")).toBe(screen.getByName("field"));
        expect(within(screen.getByName("scope")).queryByLabelText("Field")).toBeNull();
    });

    it("matches a mnemonic target only after it becomes mapped", async () => {
        const { rerender } = await render(<LabelledField isInside isVisible={false} />);
        expect(screen.queryByLabelText("Field")).toBeNull();
        await rerender(<LabelledField isInside isVisible />);
        expect(within(screen.getByName("scope")).getByLabelText("Field")).toBe(screen.getByName("field"));
    });
});
