import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkButton, GtkTextAnchor, GtkTextBuffer, GtkTextTag, GtkTextView } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { getBufferText, getTextBuffer } from "../helpers/buffer-text.js";
import { renderChildren } from "../helpers/render-children.js";
import { expectNoBufferChangedOnReconcile } from "../helpers/text-buffer-view-render.js";

const hasTagAtOffset = (buffer: Gtk.TextBuffer, tagName: string, offset: number): boolean => {
    const tagTable = buffer.getTagTable();
    const tag = tagTable.lookup(tagName);
    if (!tag) return false;

    const iter = buffer.getIterAtOffset(offset);
    return iter.hasTag(tag);
};

const buildTaggedTextView = (ref: RefObject<Gtk.TextView | null>) => (items: string[]) => (
    <GtkTextView ref={ref}>
        <GtkTextBuffer>
            {items.map((item) => (
                <GtkTextTag key={item} name={item} foreground="blue">
                    {item}
                </GtkTextTag>
            ))}
        </GtkTextBuffer>
    </GtkTextView>
);

const buildTagToggleApp =
    (ref: RefObject<Gtk.TextView | null>, name: string, tagText: string) =>
    ({ showTag }: { showTag: boolean }) => (
        <GtkTextView ref={ref}>
            <GtkTextBuffer>
                Start
                {showTag && (
                    <GtkTextTag name={name} foreground="green">
                        {tagText}
                    </GtkTextTag>
                )}
                End
            </GtkTextBuffer>
        </GtkTextView>
    );

describe("render - TextView (1)", () => {
    describe("basic text content", () => {
        it("renders plain text inside the buffer", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>Hello World</GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(buffer).not.toBeNull();
            expect(getBufferText(buffer)).toBe("Hello World");
        });

        it("renders multiple text segments", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        {"Hello"} {"World"}
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Hello World");
        });

        it("handles empty TextView", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(<GtkTextView ref={ref} />);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("");
        });

        it("handles special characters", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>Special: &amp; &lt; &gt; &quot;</GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe('Special: & < > "');
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
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        Hello <GtkTextTag name="bold">World</GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Hello World");

            expect(hasTagAtOffset(buffer, "bold", 0)).toBe(false);
            expect(hasTagAtOffset(buffer, "bold", 6)).toBe(true);
        });

        it("renders text with foreground color", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        <GtkTextTag name="red" foreground="red">
                            Red Text
                        </GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Red Text");
            expect(hasTagAtOffset(buffer, "red", 0)).toBe(true);
        });
    });
});

describe("render - TextView - tag colors", () => {
    it("applies foreground and background colors to the tag", async () => {
        const ref = createRef<Gtk.TextView>();

        await render(
            <GtkTextView ref={ref}>
                <GtkTextBuffer>
                    <GtkTextTag name="colored" foreground="red" background="rgb(0,0,255)" paragraphBackground="green">
                        Colored
                    </GtkTextTag>
                </GtkTextBuffer>
            </GtkTextView>,
        );

        const buffer = getTextBuffer(ref);
        const tag = buffer?.getTagTable().lookup("colored") ?? null;
        expect(tag).not.toBeNull();
        expect(tag?.foregroundSet).toBe(true);
        expect(tag?.backgroundSet).toBe(true);
        expect(tag?.paragraphBackgroundSet).toBe(true);

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
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                            Bold Text
                        </GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Bold Text");

            const tagTable = buffer?.getTagTable();
            const boldTag = tagTable?.lookup("bold");
            expect(boldTag).not.toBeNull();
        });

        it("renders text with underline", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        <GtkTextTag name="underlined" underline={Pango.Underline.SINGLE}>
                            Underlined
                        </GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Underlined");

            const tagTable = buffer?.getTagTable();
            const tag = tagTable?.lookup("underlined");
            expect(tag).not.toBeNull();
        });
    });
});

describe("render - TextView (4)", () => {
    describe("nested TextTags", () => {
        it("supports nested tags", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        <GtkTextTag name="outer" foreground="blue">
                            Hello{" "}
                            <GtkTextTag name="inner" weight={Pango.Weight.BOLD}>
                                World
                            </GtkTextTag>
                        </GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Hello World");

            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 0)).toBe(false);
            expect(hasTagAtOffset(buffer, "outer", 6)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);
        });

        it("handles multiple sequential tags", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        <GtkTextTag name="a">{"A"}</GtkTextTag>
                        <GtkTextTag name="b">{"B"}</GtkTextTag>
                        <GtkTextTag name="c">{"C"}</GtkTextTag>
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
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
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        Click here:{" "}
                        <GtkTextAnchor>
                            <GtkButton label="Button" />
                        </GtkTextAnchor>{" "}
                        to continue.
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
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
            const ref = createRef<Gtk.TextView>();

            function App({ text }: { text: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>{text}</GtkTextBuffer>
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App text="Initial" />);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Initial");

            await rerender(<App text="Updated" />);
            expect(getBufferText(buffer)).toBe("Updated");
        });

        it("creates tagged text correctly", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ boldText }: { boldText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>
                            Hello{" "}
                            <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                                {boldText}
                            </GtkTextTag>
                        </GtkTextBuffer>
                    </GtkTextView>
                );
            }

            await render(<App boldText="World" />);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Hello World");
            expect(hasTagAtOffset(buffer, "bold", 6)).toBe(true);
        });
    });
});

describe("render - TextView (7)", () => {
    describe("dynamic updates (2)", () => {
        it("renders conditional text segments", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ showMiddle }: { showMiddle: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>Start{showMiddle && " Middle"} End</GtkTextBuffer>
                    </GtkTextView>
                );
            }

            await render(<App showMiddle={true} />);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Start Middle End");
        });

        it("renders with conditional TextTag", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ isBold }: { isBold: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>
                            {isBold ? (
                                <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>
                                    Bold
                                </GtkTextTag>
                            ) : (
                                "Normal"
                            )}
                        </GtkTextBuffer>
                    </GtkTextView>
                );
            }

            await render(<App isBold={true} />);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Bold");
            expect(hasTagAtOffset(buffer, "bold", 0)).toBe(true);
        });
    });
});

describe("render - TextView (8)", () => {
    describe("callbacks", () => {
        it("does not call onChanged during React reconciliation", async () => {
            await expectNoBufferChangedOnReconcile((onChanged, text) => (
                <GtkTextView>
                    <GtkTextBuffer onChanged={onChanged}>{text}</GtkTextBuffer>
                </GtkTextView>
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
                <GtkTextView ref={ref}>
                    <GtkTextBuffer enableUndo={enableUndo}>Content</GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(buffer?.getEnableUndo()).toBe(enableUndo);
        });
    });
});

describe("render - TextView (9)", () => {
    describe("mixed content order", () => {
        it("maintains correct text order with mixed content", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextBuffer>
                        Start{" "}
                        <GtkTextTag name="tag1" foreground="red">
                            Red
                        </GtkTextTag>{" "}
                        Middle{" "}
                        <GtkTextTag name="tag2" foreground="blue">
                            Blue
                        </GtkTextTag>{" "}
                        End
                    </GtkTextBuffer>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
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
            const ref = createRef<Gtk.TextView>();

            function App({ innerText }: { innerText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>
                            <GtkTextTag name="first" foreground="red">
                                {innerText}
                            </GtkTextTag>
                            <GtkTextTag name="second" foreground="blue">
                                Second
                            </GtkTextTag>
                        </GtkTextBuffer>
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App innerText="Short" />);
            const buffer = getTextBuffer(ref);

            expect(getBufferText(buffer)).toBe("ShortSecond");
            expect(hasTagAtOffset(buffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "second", 5)).toBe(true);

            await rerender(<App innerText="MuchLongerText" />);

            expect(getBufferText(buffer)).toBe("MuchLongerTextSecond");
            expect(hasTagAtOffset(buffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "second", 14)).toBe(true);
        });
    });
});

describe("render - TextView (11)", () => {
    describe("dynamic updates - comprehensive (2)", () => {
        it("adds new tag dynamically", async () => {
            const ref = createRef<Gtk.TextView>();
            const App = buildTagToggleApp(ref, "dynamic", "New");

            const { rerender } = await render(<App showTag={false} />);
            const buffer = getTextBuffer(ref);

            expect(getBufferText(buffer)).toBe("StartEnd");

            await rerender(<App showTag={true} />);

            expect(getBufferText(buffer)).toBe("StartNewEnd");
            expect(hasTagAtOffset(buffer, "dynamic", 5)).toBe(true);
        });
    });
});

describe("render - TextView (12)", () => {
    describe("dynamic updates - comprehensive (3)", () => {
        it("removes tag dynamically", async () => {
            const ref = createRef<Gtk.TextView>();
            const App = buildTagToggleApp(ref, "removable", "Remove");

            const { rerender } = await render(<App showTag={true} />);
            const buffer = getTextBuffer(ref);

            expect(getBufferText(buffer)).toBe("StartRemoveEnd");
            expect(hasTagAtOffset(buffer, "removable", 5)).toBe(true);

            await rerender(<App showTag={false} />);

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
    describe("dynamic updates - comprehensive (4)", () => {
        it("handles text change inside nested tag", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ innerText }: { innerText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <GtkTextBuffer>
                            <GtkTextTag name="outer" foreground="blue">
                                Outer{" "}
                                <GtkTextTag name="inner" weight={Pango.Weight.BOLD}>
                                    {innerText}
                                </GtkTextTag>
                            </GtkTextTag>{" "}
                            After
                        </GtkTextBuffer>
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App innerText="Inner" />);
            const buffer = getTextBuffer(ref);

            expect(getBufferText(buffer)).toBe("Outer Inner After");
            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);

            await rerender(<App innerText="NestedText" />);

            expect(getBufferText(buffer)).toBe("Outer NestedText After");
            expect(hasTagAtOffset(buffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer, "inner", 6)).toBe(true);
        });
    });
});
