import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkTextView } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { getBufferText, getTextBuffer } from "../helpers/buffer-text.js";
import { renderChildren } from "../helpers/render-children.js";

const hasTagAtOffset = (buffer: Gtk.TextBuffer, tagName: string, offset: number): boolean => {
    const tagTable = buffer.getTagTable();
    const tag = tagTable.lookup(tagName);
    if (!tag) return false;

    const iter = buffer.getIterAtOffset(offset);
    return iter.hasTag(tag);
};

const buildTaggedTextView = (ref: RefObject<Gtk.TextView | null>) => (items: string[]) => (
    <GtkTextView ref={ref}>
        {items.map((item) => (
            <GtkTextView.Tag key={item} id={item} foreground="blue">
                {item}
            </GtkTextView.Tag>
        ))}
    </GtkTextView>
);

describe("render - TextView (1)", () => {
    describe("basic text content", () => {
        it("renders plain text inside TextView", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(<GtkTextView ref={ref}>Hello World</GtkTextView>);

            const buffer = getTextBuffer(ref);
            expect(buffer).not.toBeNull();
            expect(getBufferText(buffer)).toBe("Hello World");
        });

        it("renders multiple text segments", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    {"Hello"} {"World"}
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

            await render(<GtkTextView ref={ref}>Special: &amp; &lt; &gt; &quot;</GtkTextView>);

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe('Special: & < > "');
        });
    });
});

describe("render - TextView (2)", () => {
    describe("TextTag styling (1)", () => {
        it("applies TextTag to wrapped text", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    Hello <GtkTextView.Tag id="bold">World</GtkTextView.Tag>
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
                    <GtkTextView.Tag id="red" foreground="red">
                        Red Text
                    </GtkTextView.Tag>
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(getBufferText(buffer)).toBe("Red Text");
            expect(hasTagAtOffset(buffer, "red", 0)).toBe(true);
        });
    });
});

describe("render - TextView (3)", () => {
    describe("TextTag styling (2)", () => {
        it("renders text with bold weight", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <GtkTextView.Tag id="bold" weight={Pango.Weight.BOLD}>
                        Bold Text
                    </GtkTextView.Tag>
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
                    <GtkTextView.Tag id="underlined" underline={Pango.Underline.SINGLE}>
                        Underlined
                    </GtkTextView.Tag>
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
                    <GtkTextView.Tag id="outer" foreground="blue">
                        Hello{" "}
                        <GtkTextView.Tag id="inner" weight={Pango.Weight.BOLD}>
                            World
                        </GtkTextView.Tag>
                    </GtkTextView.Tag>
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
                    <GtkTextView.Tag id="a">{"A"}</GtkTextView.Tag>
                    <GtkTextView.Tag id="b">{"B"}</GtkTextView.Tag>
                    <GtkTextView.Tag id="c">{"C"}</GtkTextView.Tag>
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
                    Click here:{" "}
                    <GtkTextView.Anchor>
                        <GtkButton label="Button" />
                    </GtkTextView.Anchor>{" "}
                    to continue.
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
                return <GtkTextView ref={ref}>{text}</GtkTextView>;
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
                        Hello{" "}
                        <GtkTextView.Tag id="bold" weight={Pango.Weight.BOLD}>
                            {boldText}
                        </GtkTextView.Tag>
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
                return <GtkTextView ref={ref}>Start{showMiddle && " Middle"} End</GtkTextView>;
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
                        {isBold ? (
                            <GtkTextView.Tag id="bold" weight={Pango.Weight.BOLD}>
                                Bold
                            </GtkTextView.Tag>
                        ) : (
                            "Normal"
                        )}
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
        it("does not call onBufferChanged during React reconciliation", async () => {
            const ref = createRef<Gtk.TextView>();
            const onBufferChanged = vi.fn();

            function App({ text }: { text: string }) {
                return (
                    <GtkTextView ref={ref} onBufferChanged={onBufferChanged}>
                        {text}
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App text="Initial" />);

            await rerender(<App text="Updated" />);

            expect(onBufferChanged).not.toHaveBeenCalled();
        });
    });

    describe("enableUndo", () => {
        it("sets enableUndo on buffer", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref} enableUndo>
                    Content
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(buffer?.getEnableUndo()).toBe(true);
        });

        it("disables undo when enableUndo is false", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref} enableUndo={false}>
                    Content
                </GtkTextView>,
            );

            const buffer = getTextBuffer(ref);
            expect(buffer?.getEnableUndo()).toBe(false);
        });
    });
});

describe("render - TextView (9)", () => {
    describe("mixed content order", () => {
        it("maintains correct text order with mixed content", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    Start{" "}
                    <GtkTextView.Tag id="tag1" foreground="red">
                        Red
                    </GtkTextView.Tag>{" "}
                    Middle{" "}
                    <GtkTextView.Tag id="tag2" foreground="blue">
                        Blue
                    </GtkTextView.Tag>{" "}
                    End
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
                        <GtkTextView.Tag id="first" foreground="red">
                            {innerText}
                        </GtkTextView.Tag>
                        <GtkTextView.Tag id="second" foreground="blue">
                            Second
                        </GtkTextView.Tag>
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

            function App({ showTag }: { showTag: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        Start
                        {showTag && (
                            <GtkTextView.Tag id="dynamic" foreground="green">
                                New
                            </GtkTextView.Tag>
                        )}
                        End
                    </GtkTextView>
                );
            }

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

            function App({ showTag }: { showTag: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        Start
                        {showTag && (
                            <GtkTextView.Tag id="removable" foreground="green">
                                Remove
                            </GtkTextView.Tag>
                        )}
                        End
                    </GtkTextView>
                );
            }

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
                        <GtkTextView.Tag id="outer" foreground="blue">
                            Outer{" "}
                            <GtkTextView.Tag id="inner" weight={Pango.Weight.BOLD}>
                                {innerText}
                            </GtkTextView.Tag>
                        </GtkTextView.Tag>{" "}
                        After
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
