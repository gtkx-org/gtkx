import type { ReactElement, ReactNode, RefObject } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import {
    GtkButton,
    GtkEntry,
    GtkEntryBuffer,
    GtkTextBuffer,
    GtkTextChildAnchor,
    GtkTextMark,
    GtkTextTag,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { getBufferText, getTextBuffer } from "../helpers/buffer-text.js";
import { countPaintables, lookupIconPaintable } from "../helpers/icon-paintable.js";
import { expectNoBufferChangedOnReconcile } from "../helpers/text-buffer-view-render.js";

type RenderedTextBuffer<P> = {
    buffer: Gtk.TextBuffer;
    rerender: (props: P) => Promise<void>;
};

type AnchorFixture = {
    icon: Gtk.IconPaintable;
    buffer: Gtk.TextBuffer;
    rerender: (content: ReactNode) => Promise<void>;
};

type TextProps = (text: string) => { text: string } | { buffer: ReactElement };
type ControlledEntryProps = { entryRef: RefObject<Gtk.Entry | null>; initial: string; textProps: TextProps };

const CARRIERS: [string, TextProps][] = [["text prop", directText], ["entry buffer", bufferedText]];

const renderTextBuffer = async <P,>(
    initialProps: NoInfer<P>,
    buildBufferContent: (props: P) => ReactNode,
): Promise<RenderedTextBuffer<P>> => {
    const ref = createRef<Gtk.TextView>();

    const buildView = (props: P) => (
        <GtkTextView ref={ref} buffer={<GtkTextBuffer>{buildBufferContent(props)}</GtkTextBuffer>} />
    );

    const { rerender } = await render(buildView(initialProps));

    return {
        buffer: getTextBuffer(ref),
        rerender: (props: P) => rerender(buildView(props)),
    };
};

const hasTagAtOffset = (buffer: Gtk.TextBuffer, tagName: string, offset: number): boolean => {
    const tagTable = buffer.getTagTable();
    const tag = tagTable.lookup(tagName);

    if (!tag) {
        return false;
    }

    const iter = buffer.getIterAtOffset(offset);

    return iter.hasTag(tag);
};

const buildNestedTagContent = (outerText: string, innerText: string): ReactNode => (
    <GtkTextTag name="outer" foreground="blue">
        {outerText}
        <GtkTextTag name="inner" weight={Pango.Weight.BOLD}>
            {innerText}
        </GtkTextTag>
    </GtkTextTag>
);

const buildMarkOrTag = (item: string, markRef: RefObject<Gtk.TextMark | null>): ReactNode =>
    item === "M"
        ? (
                <GtkTextMark key="M" ref={markRef} />
            )
        : (
                <GtkTextTag key={item} name={item}>
                    {item.repeat(3)}
                </GtkTextTag>
            );

const requireMark = (markRef: RefObject<Gtk.TextMark | null>): Gtk.TextMark => {
    const mark = markRef.current;

    if (mark === null) {
        throw new Error("Expected the GtkTextMark to be assigned");
    }

    return mark;
};

const buildTaggedTextView = (ref: RefObject<Gtk.TextView | null>) => (items: string[]) => (
    <GtkTextView
        ref={ref}
        buffer={(
            <GtkTextBuffer>
                {items.map((item) => (
                    <GtkTextTag key={item} name={item} foreground="blue">
                        {item}
                    </GtkTextTag>
                ))}
            </GtkTextBuffer>
        )}
    />
);

const buildToggleContent =
    (name: string, tagText: string) =>
        (hasTag: boolean): ReactNode => (
            <>
                Start
                {hasTag && (
                    <GtkTextTag name={name} foreground="green">
                        {tagText}
                    </GtkTextTag>
                )}
                End
            </>
        );

const buildAnchorView = (hasAnchor: boolean) => (
    <GtkTextView
        buffer={(
            <GtkTextBuffer>
                Start
                {hasAnchor && (
                    <GtkTextChildAnchor>
                        <GtkButton label="Embedded" />
                    </GtkTextChildAnchor>
                )}
                End
            </GtkTextBuffer>
        )}
    />
);

const buildMarkedView = (viewRef: RefObject<Gtk.TextView | null>, markRef: RefObject<Gtk.TextMark | null>) => (
    <GtkTextView
        ref={viewRef}
        buffer={(
            <GtkTextBuffer>
                AB
                <GtkTextMark ref={markRef} />
                CD
            </GtkTextBuffer>
        )}
    />
);

const buildReorderableMarkView =
    (viewRef: RefObject<Gtk.TextView | null>, markRef: RefObject<Gtk.TextMark | null>) =>
        (order: string[]) => (
            <GtkTextView
                ref={viewRef}
                buffer={(
                    <GtkTextBuffer>
                        {order.map((item) => buildMarkOrTag(item, markRef))}
                    </GtkTextBuffer>
                )}
            />
        );

const buildPaintableView = (viewRef: RefObject<Gtk.TextView | null>) => (content: ReactNode) => (
    <GtkTextView ref={viewRef} buffer={<GtkTextBuffer>{content}</GtkTextBuffer>} />
);

const buildInlineContent = (paintable: Gdk.Paintable | null, trailing: string): ReactNode => (
    <>
        {"before "}
        {paintable === null ? null : <GtkTextChildAnchor paintable={paintable} />}
        {trailing}
    </>
);

const buildTaggedContent = (prefix: string, paintable: Gdk.Paintable): ReactNode => (
    <>
        {prefix}
        <GtkTextTag name="logo" pixelsAboveLines={200}>
            <GtkTextChildAnchor paintable={paintable} />
        </GtkTextTag>
    </>
);

const buildAnchorContent = (label: string): ReactNode => (
    <>
        {"before "}
        <GtkTextChildAnchor>
            <GtkButton label={label} />
        </GtkTextChildAnchor>
        {" after"}
    </>
);

const buildRefAnchorContent = (anchorRef: RefObject<Gtk.TextChildAnchor | null>): ReactNode => (
    <>
        {"before "}
        <GtkTextChildAnchor ref={anchorRef}>
            <GtkButton label="Embedded" />
        </GtkTextChildAnchor>
        {" after"}
    </>
);

const buildMixedContent = (paintable: Gdk.Paintable): ReactNode => (
    <GtkTextChildAnchor paintable={paintable}>
        <GtkButton label="Nope" />
    </GtkTextChildAnchor>
);

const hasTagAtOffset2 = (buffer: Gtk.TextBuffer, tagName: string, offset: number): boolean => {
    const tag = buffer.getTagTable().lookup(tagName);

    return tag !== null && buffer.getIterAtOffset(offset).hasTag(tag);
};

const paintableAtOffset = (buffer: Gtk.TextBuffer, offset: number): Gdk.Paintable | null =>
    buffer.getIterAtOffset(offset).getPaintable();

const anchorAtOffset = (buffer: Gtk.TextBuffer, offset: number): Gtk.TextChildAnchor | null =>
    buffer.getIterAtOffset(offset).getChildAnchor();

const renderAnchorContent = async (build: (icon: Gtk.IconPaintable) => ReactNode): Promise<AnchorFixture> => {
    const icon = lookupIconPaintable("image-x-generic-symbolic");
    const viewRef = createRef<Gtk.TextView>();
    const buildView = buildPaintableView(viewRef);
    const { rerender } = await render(buildView(build(icon)));

    return {
        icon,
        buffer: getTextBuffer(viewRef),
        rerender: async (content) => {
            await rerender(buildView(content));
        },
    };
};

const buildInlineIcon = (icon: Gtk.IconPaintable): ReactNode => buildInlineContent(icon, " after");

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

describe("render - TextView (1)", () => {
    describe("basic text content", () => {
        it("renders plain text inside the buffer", async () => {
            await renderTextBuffer(undefined, () => "Hello World");
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Hello World");
        });

        it("renders multiple text segments", async () => {
            await renderTextBuffer(undefined, () => (
                <>
                    Hello
                    {" "}
                    World
                </>
            ));

            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Hello World");
        });

        it("handles empty TextView", async () => {
            await render(<GtkTextView />);
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("");
        });

        it("handles special characters", async () => {
            await renderTextBuffer(undefined, () => 'Special: & < > "');
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue('Special: & < > "');
        });

        it("throws for text directly under the view", async () => {
            await expect(render(<GtkTextView>Hello</GtkTextView>)).rejects.toThrow(
                /must be rendered within a <GtkLabel> or <GtkTextBuffer>/,
            );
        });
    });
});

describe("render - TextView (2)", () => {
    describe("TextTag styling (1)", () => {
        it("applies TextTag to wrapped text", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <>
                    Hello
                    {" "}
                    <GtkTextTag name="bold">World</GtkTextTag>
                </>
            ));

            expect(getBufferText(buffer)).toBe("Hello World");
            expect(hasTagAtOffset(buffer, "bold", 0)).toBe(false);
            expect(hasTagAtOffset(buffer, "bold", 6)).toBe(true);
        });

        it("renders text with foreground color", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <GtkTextTag name="red" foreground="red">
                    Red Text
                </GtkTextTag>
            ));

            expect(getBufferText(buffer)).toBe("Red Text");
            expect(hasTagAtOffset(buffer, "red", 0)).toBe(true);
        });
    });
});

describe("render - TextView - tag colors", () => {
    it("applies foreground and background colors to the tag", async () => {
        const { buffer } = await renderTextBuffer(undefined, () => (
            <GtkTextTag name="colored" foreground="red" background="rgb(0,0,255)" paragraphBackground="green">
                Colored
            </GtkTextTag>
        ));

        const tag = buffer.getTagTable().lookup("colored") ?? null;
        expect(tag).not.toBeNull();
        expect(tag).toHaveObjectProperty("foregroundSet", true);
        expect(tag).toHaveObjectProperty("backgroundSet", true);
        expect(tag).toHaveObjectProperty("paragraphBackgroundSet", true);
        const fg = tag?.foregroundRgba ?? null;
        expect(fg).not.toBeNull();
        expect(fg?.red).toBeCloseTo(1, 2);
        expect(fg?.green).toBeCloseTo(0, 2);
        expect(fg?.blue).toBeCloseTo(0, 2);
        const bg = tag?.backgroundRgba ?? null;
        expect(bg).not.toBeNull();
        expect(bg?.red).toBeCloseTo(0, 2);
        expect(bg?.blue).toBeCloseTo(1, 2);
    });
});

describe("render - TextView (3)", () => {
    describe("TextTag styling (2)", () => {
        it("renders text with bold weight", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                    Bold Text
                </GtkTextTag>
            ));

            expect(getBufferText(buffer)).toBe("Bold Text");
            const tagTable = buffer.getTagTable();
            const boldTag = tagTable.lookup("bold");
            expect(boldTag).not.toBeNull();
        });

        it("renders text with underline", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <GtkTextTag name="underlined" underline={Pango.Underline.SINGLE}>
                    Underlined
                </GtkTextTag>
            ));

            expect(getBufferText(buffer)).toBe("Underlined");
            const tagTable = buffer.getTagTable();
            const tag = tagTable.lookup("underlined");
            expect(tag).not.toBeNull();
        });
    });
});

describe("render - TextView (4)", () => {
    describe("nested TextTags", () => {
        it("supports nested tags", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => buildNestedTagContent("Hello ", "World"));
            expect(getBufferText(buffer)).toBe("Hello World");
            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 0)).toBe(false);
            expect(hasTagAtOffset(buffer, "outer", 6)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);
        });

        it("handles multiple sequential tags", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <>
                    <GtkTextTag name="a">A</GtkTextTag>
                    <GtkTextTag name="b">B</GtkTextTag>
                    <GtkTextTag name="c">C</GtkTextTag>
                </>
            ));

            expect(getBufferText(buffer)).toBe("ABC");
            expect(hasTagAtOffset(buffer, "a", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "b", 1)).toBe(true);
            expect(hasTagAtOffset(buffer, "c", 2)).toBe(true);
        });
    });
});

describe("render - TextView (5)", () => {
    describe("TextAnchor embedded widgets", () => {
        it("embeds widget at anchor position", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <>
                    Click here:
                    {" "}
                    <GtkTextChildAnchor>
                        <GtkButton label="Button" />
                    </GtkTextChildAnchor>
                    {" "}
                    to continue.
                </>
            ));

            const text = getBufferText(buffer);
            expect(text).toContain("Click here: ");
            expect(text).toContain(" to continue.");
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
            expect(button).toBeRooted();
        });
    });
});

describe("render - TextView (6)", () => {
    describe("dynamic updates (1)", () => {
        it("updates text content on rerender", async () => {
            const { rerender } = await renderTextBuffer("Initial", (text: string) => text);
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Initial");
            await rerender("Updated");
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Updated");
        });

        it("creates tagged text correctly", async () => {
            const { buffer } = await renderTextBuffer("World", (boldText: string) => (
                <>
                    Hello
                    {" "}
                    <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                        {boldText}
                    </GtkTextTag>
                </>
            ));

            expect(getBufferText(buffer)).toBe("Hello World");
            expect(hasTagAtOffset(buffer, "bold", 6)).toBe(true);
        });
    });
});

describe("render - TextView (7)", () => {
    describe("dynamic updates (2)", () => {
        it("renders conditional text segments", async () => {
            await renderTextBuffer(true, (hasMiddle: boolean) => (
                <>
                    Start
                    {hasMiddle && " Middle"}
                    {" "}
                    End
                </>
            ));

            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Start Middle End");
        });

        it("renders with conditional TextTag", async () => {
            const { buffer } = await renderTextBuffer(true, (isBold: boolean) =>
                isBold
                    ? (
                            <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                                Bold
                            </GtkTextTag>
                        )
                    : (
                            "Normal"
                        ),
            );

            expect(getBufferText(buffer)).toBe("Bold");
            expect(hasTagAtOffset(buffer, "bold", 0)).toBe(true);
        });
    });
});

describe("render - TextView (8)", () => {
    describe("callbacks", () => {
        it("does not call onChanged during React reconciliation", async () => {
            await expectNoBufferChangedOnReconcile((onChanged, text) => (
                <GtkTextView buffer={<GtkTextBuffer onChanged={onChanged}>{text}</GtkTextBuffer>} />
            ));
        });
    });

    describe("enableUndo", () => {
        it.each([
            ["sets enableUndo on buffer", true],
            ["disables undo when enableUndo is false", false],
        ])("%s", async (_title, enableUndo) => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref} buffer={<GtkTextBuffer enableUndo={enableUndo}>Content</GtkTextBuffer>} />,
            );

            const buffer = getTextBuffer(ref);
            expect(buffer).toHaveObjectProperty("enableUndo", enableUndo);
        });
    });
});

describe("render - TextView (9)", () => {
    describe("mixed content order", () => {
        it("maintains correct text order with mixed content", async () => {
            const { buffer } = await renderTextBuffer(undefined, () => (
                <>
                    Start
                    {" "}
                    <GtkTextTag name="tag1" foreground="red">
                        Red
                    </GtkTextTag>
                    {" "}
                    Middle
                    {" "}
                    <GtkTextTag name="tag2" foreground="blue">
                        Blue
                    </GtkTextTag>
                    {" "}
                    End
                </>
            ));

            expect(getBufferText(buffer)).toBe("Start Red Middle Blue End");
            expect(hasTagAtOffset(buffer, "tag1", 6)).toBe(true);
            expect(hasTagAtOffset(buffer, "tag2", 18)).toBe(true);
        });

        it("handles mapped items with keys", async () => {
            const ref = createRef<Gtk.TextView>();
            await renderChildren(["A", "B", "C"], buildTaggedTextView(ref));
            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("ABC");
            expect(hasTagAtOffset(buffer, "A", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "B", 1)).toBe(true);
            expect(hasTagAtOffset(buffer, "C", 2)).toBe(true);
        });
    });
});

describe("render - TextView (10)", () => {
    describe("dynamic updates - comprehensive (1)", () => {
        it("updates text inside a tag and maintains subsequent tag offsets", async () => {
            const { buffer, rerender } = await renderTextBuffer("Short", (innerText: string) => (
                <>
                    <GtkTextTag name="first" foreground="red">
                        {innerText}
                    </GtkTextTag>
                    <GtkTextTag name="second" foreground="blue">
                        Second
                    </GtkTextTag>
                </>
            ));

            expect(getBufferText(buffer)).toBe("ShortSecond");
            expect(hasTagAtOffset(buffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "second", 5)).toBe(true);
            await rerender("MuchLongerText");
            expect(getBufferText(buffer)).toBe("MuchLongerTextSecond");
            expect(hasTagAtOffset(buffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "second", 14)).toBe(true);
        });
    });
});

describe("render - TextView (11)", () => {
    describe("dynamic updates - comprehensive (2)", () => {
        it("adds new tag dynamically", async () => {
            const { buffer, rerender } = await renderTextBuffer(false, buildToggleContent("dynamic", "New"));
            expect(getBufferText(buffer)).toBe("StartEnd");
            await rerender(true);
            expect(getBufferText(buffer)).toBe("StartNewEnd");
            expect(hasTagAtOffset(buffer, "dynamic", 5)).toBe(true);
        });
    });
});

describe("render - TextView (12)", () => {
    describe("dynamic updates - comprehensive (3)", () => {
        it("removes tag dynamically", async () => {
            const { buffer, rerender } = await renderTextBuffer(true, buildToggleContent("removable", "Remove"));
            expect(getBufferText(buffer)).toBe("StartRemoveEnd");
            expect(hasTagAtOffset(buffer, "removable", 5)).toBe(true);
            await rerender(false);
            expect(getBufferText(buffer)).toBe("StartEnd");
        });

        it("reorders tags correctly", async () => {
            const ref = createRef<Gtk.TextView>();
            const { rerender } = await renderChildren(["A", "B", "C"], buildTaggedTextView(ref));
            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("ABC");
            await rerender(["C", "A", "B"]);
            expect(getBufferText(buffer)).toBe("CAB");
            expect(hasTagAtOffset(buffer, "C", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "A", 1)).toBe(true);
            expect(hasTagAtOffset(buffer, "B", 2)).toBe(true);
        });
    });
});

describe("render - TextView (13)", () => {
    describe("content model", () => {
        it("throws when a buffer mixes a text prop with content children", async () => {
            await expect(
                render(<GtkTextView buffer={<GtkTextBuffer text="prop">children</GtkTextBuffer>} />),
            ).rejects.toThrow(/cannot mix a `text` prop with content children/);
        });

        it("places a GtkTextMark at its position in the content", async () => {
            const markRef = createRef<Gtk.TextMark>();
            const viewRef = createRef<Gtk.TextView>();
            await render(buildMarkedView(viewRef, markRef));
            const buffer = getTextBuffer(viewRef);
            expect(getBufferText(buffer)).toBe("ABCD");
            const mark = requireMark(markRef);
            expect(mark.getBuffer()).toBe(buffer);
            expect(buffer.getIterAtMark(mark).getOffset()).toBe(2);
        });

        it("keeps a GtkTextMark in place when keyed siblings reorder", async () => {
            const markRef = createRef<Gtk.TextMark>();
            const viewRef = createRef<Gtk.TextView>();
            const buildView = buildReorderableMarkView(viewRef, markRef);
            const { rerender } = await render(buildView(["A", "M", "B"]));
            const buffer = getTextBuffer(viewRef);
            expect(getBufferText(buffer)).toBe("AAABBB");
            await rerender(buildView(["B", "M", "A"]));
            expect(getBufferText(buffer)).toBe("BBBAAA");
            const mark = requireMark(markRef);
            expect(buffer.getIterAtMark(mark).getOffset()).toBe(3);
        });

        it("removes the embedded widget when its anchor unmounts", async () => {
            const { rerender } = await render(buildAnchorView(true));
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON)).toBeRooted();
            await rerender(buildAnchorView(false));
            expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("StartEnd");
        });
    });
});

describe("render - TextView (14)", () => {
    describe("dynamic updates - comprehensive (4)", () => {
        it("handles text change inside nested tag", async () => {
            const { buffer, rerender } = await renderTextBuffer("Inner", (innerText: string) => (
                <>
                    {buildNestedTagContent("Outer ", innerText)}
                    {" "}
                    After
                </>
            ));

            expect(getBufferText(buffer)).toBe("Outer Inner After");
            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);
            await rerender("NestedText");
            expect(getBufferText(buffer)).toBe("Outer NestedText After");
            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);
        });
    });
});

describe("render - TextChildAnchor paintables", () => {
    it("inserts a paintable at its position in the content", async () => {
        const { icon, buffer } = await renderAnchorContent(buildInlineIcon);
        expect(countPaintables(buffer)).toBe(1);
        expect(paintableAtOffset(buffer, 7)).toBe(icon);
        expect(getBufferText(buffer)).toBe("before  after");
    });

    it("replaces the paintable when the prop changes", async () => {
        const { buffer, rerender } = await renderAnchorContent(buildInlineIcon);
        const other = lookupIconPaintable("folder-symbolic");
        await rerender(buildInlineContent(other, " after"));
        expect(countPaintables(buffer)).toBe(1);
        expect(paintableAtOffset(buffer, 7)).toBe(other);
    });

    it("removes the paintable on unmount, preserving surrounding text", async () => {
        const { buffer, rerender } = await renderAnchorContent(buildInlineIcon);
        await rerender(buildInlineContent(null, " after"));
        expect(countPaintables(buffer)).toBe(0);
        expect(getBufferText(buffer)).toBe("before  after");
    });
});

describe("render - TextChildAnchor paintable offsets", () => {
    it("keeps offsets of following text correct when it updates", async () => {
        const { icon, buffer, rerender } = await renderAnchorContent(buildInlineIcon);
        await rerender(buildInlineContent(icon, " a much longer trailing run"));
        expect(countPaintables(buffer)).toBe(1);
        expect(paintableAtOffset(buffer, 7)).toBe(icon);
        expect(getBufferText(buffer)).toBe("before  a much longer trailing run");
    });

    it("applies an enclosing tag to the paintable", async () => {
        const { icon, buffer, rerender } = await renderAnchorContent((item) => buildTaggedContent("short", item));
        expect(hasTagAtOffset2(buffer, "logo", 5)).toBe(true);
        await rerender(buildTaggedContent("a much longer prefix", icon));
        expect(countPaintables(buffer)).toBe(1);
        expect(hasTagAtOffset2(buffer, "logo", 20)).toBe(true);
    });
});

describe("render - TextChildAnchor identity", () => {
    it("inserts the element's own anchor into the buffer", async () => {
        const anchorRef = createRef<Gtk.TextChildAnchor>();
        const { buffer } = await renderAnchorContent(() => buildRefAnchorContent(anchorRef));
        expect(anchorAtOffset(buffer, 7)).toBe(anchorRef.current);
        expect(anchorRef.current?.getDeleted()).toBe(false);
    });

    it("keeps the anchor usable across a buffer rebuild", async () => {
        const { buffer, rerender } = await renderAnchorContent(() => buildAnchorContent("First"));
        await rerender(buildAnchorContent("Second"));
        expect(anchorAtOffset(buffer, 7)).not.toBeNull();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON)).toBeRooted();
        expect(getBufferText(buffer)).toBe("before  after");
    });
});

describe("render - TextChildAnchor content model", () => {
    it("throws when an anchor mixes a paintable prop with a child widget", async () => {
        const icon = lookupIconPaintable("image-x-generic-symbolic");
        const viewRef = createRef<Gtk.TextView>();
        const view = buildPaintableView(viewRef)(buildMixedContent(icon));
        await expect(render(view)).rejects.toThrow(/cannot mix a `paintable` prop with a child widget/);
    });
});

describe("render - controlled editable text", () => {
    it.each(CARRIERS)("leaves the caret after text typed through the %s", async (_carrier, textProps) => {
        const entry = await typeIntoControlled(textProps);
        expect(entry).toHaveDisplayValue("abc");
        expect(entry.getPosition()).toBe(3);
    });

    it.each(CARRIERS)("writes %s text the widget does not already hold", async (_carrier, textProps) => {
        const entry = await rerenderUncontrolled(textProps);
        expect(entry).toHaveDisplayValue("two");
    });

    it("appends successive characters typed without refocusing", async () => {
        const entry = await typeIntoControlled(directText);
        await userEvent.type(entry, "d", { shouldFocus: false });
        expect(entry).toHaveDisplayValue("abcd");
    });
});
