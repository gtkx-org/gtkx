import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkButton, GtkTextBuffer, GtkTextChildAnchor, GtkTextMark, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { getBufferText, getTextBuffer } from "../helpers/buffer-text.js";
import { expectNoBufferChangedOnReconcile } from "../helpers/text-buffer-view-render.js";

type RenderedTextBuffer<P> = {
    buffer: Gtk.TextBuffer;
    rerender: (props: P) => Promise<void>;
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

describe("render - TextView (1)", () => {
    describe("basic text content", () => {
        it("renders plain text inside the buffer", async () => {
            await renderTextBuffer(undefined, () => "Hello World");
            expect(screen.getByDisplayValue("Hello World")).toBeDefined();
        });

        it("renders multiple text segments", async () => {
            await renderTextBuffer(undefined, () => (
                <>
                    Hello
                    {" "}
                    World
                </>
            ));

            expect(screen.getByDisplayValue("Hello World")).toBeDefined();
        });

        it("handles empty TextView", async () => {
            await render(<GtkTextView />);
            expect(screen.getByDisplayValue("")).toBeDefined();
        });

        it("handles special characters", async () => {
            await renderTextBuffer(undefined, () => 'Special: & < > "');
            expect(screen.getByDisplayValue('Special: & < > "')).toBeDefined();
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
            expect(button).toBeDefined();
        });
    });
});

describe("render - TextView (6)", () => {
    describe("dynamic updates (1)", () => {
        it("updates text content on rerender", async () => {
            const { rerender } = await renderTextBuffer("Initial", (text: string) => text);
            expect(screen.getByDisplayValue("Initial")).toBeDefined();
            await rerender("Updated");
            expect(screen.getByDisplayValue("Updated")).toBeDefined();
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

            expect(screen.getByDisplayValue("Start Middle End")).toBeDefined();
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
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON)).toBeDefined();
            await rerender(buildAnchorView(false));
            expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
            expect(screen.getByDisplayValue("StartEnd")).toBeDefined();
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
