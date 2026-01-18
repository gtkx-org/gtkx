import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkButton, GtkTextView, x } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const getBufferText = (buffer: Gtk.TextBuffer): string => {
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();

    batch(() => {
        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);
    });

    return buffer.getText(startIter, endIter, true);
};

const hasTagAtOffset = (buffer: Gtk.TextBuffer, tagName: string, offset: number): boolean => {
    const tagTable = buffer.getTagTable();
    const tag = tagTable.lookup(tagName);
    if (!tag) return false;

    const iter = new Gtk.TextIter();
    buffer.getIterAtOffset(iter, offset);
    return iter.hasTag(tag);
};

describe("render - TextView", () => {
    describe("basic text content", () => {
        it("renders plain text inside TextView", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(<GtkTextView ref={ref}>Hello World</GtkTextView>);

            const buffer = ref.current?.getBuffer();
            expect(buffer).not.toBeNull();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Hello World");
        });

        it("renders multiple text segments", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    {"Hello"} {"World"}
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Hello World");
        });

        it("handles empty TextView", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(<GtkTextView ref={ref} />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("");
        });

        it("handles special characters", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(<GtkTextView ref={ref}>Special: &amp; &lt; &gt; &quot;</GtkTextView>);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe('Special: & < > "');
        });
    });

    describe("TextTag styling", () => {
        it("applies TextTag to wrapped text", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    Hello <x.TextTag id="bold">World</x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Hello World");

            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "bold", 0)).toBe(false);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "bold", 6)).toBe(true);
        });

        it("renders text with foreground color", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <x.TextTag id="red" foreground="red">
                        Red Text
                    </x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Red Text");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "red", 0)).toBe(true);
        });

        it("renders text with bold weight", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
                        Bold Text
                    </x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Bold Text");

            const tagTable = buffer?.getTagTable();
            const boldTag = tagTable?.lookup("bold");
            expect(boldTag).not.toBeNull();
        });

        it("renders text with underline", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <x.TextTag id="underlined" underline={Pango.Underline.SINGLE}>
                        Underlined
                    </x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Underlined");

            const tagTable = buffer?.getTagTable();
            const tag = tagTable?.lookup("underlined");
            expect(tag).not.toBeNull();
        });
    });

    describe("nested TextTags", () => {
        it("supports nested tags", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <x.TextTag id="outer" foreground="blue">
                        Hello{" "}
                        <x.TextTag id="inner" weight={Pango.Weight.BOLD}>
                            World
                        </x.TextTag>
                    </x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Hello World");

            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "inner", 0)).toBe(false);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "outer", 6)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "inner", 6)).toBe(true);
        });

        it("handles multiple sequential tags", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    <x.TextTag id="a">{"A"}</x.TextTag>
                    <x.TextTag id="b">{"B"}</x.TextTag>
                    <x.TextTag id="c">{"C"}</x.TextTag>
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("ABC");

            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "a", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "b", 1)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "c", 2)).toBe(true);
        });
    });

    describe("TextAnchor embedded widgets", () => {
        it("embeds widget at anchor position", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    Click here:{" "}
                    <x.TextAnchor>
                        <GtkButton label="Button" />
                    </x.TextAnchor>{" "}
                    to continue.
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            const text = getBufferText(buffer as Gtk.TextBuffer);
            expect(text).toContain("Click here: ");
            expect(text).toContain(" to continue.");

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
            expect(button).toBeDefined();
        });
    });

    describe("dynamic updates", () => {
        it("updates text content on rerender", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ text }: { text: string }) {
                return <GtkTextView ref={ref}>{text}</GtkTextView>;
            }

            const { rerender } = await render(<App text="Initial" />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Initial");

            await rerender(<App text="Updated" />);
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Updated");
        });

        it("creates tagged text correctly", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ boldText }: { boldText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        Hello{" "}
                        <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
                            {boldText}
                        </x.TextTag>
                    </GtkTextView>
                );
            }

            await render(<App boldText="World" />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Hello World");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "bold", 6)).toBe(true);
        });

        it("renders conditional text segments", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ showMiddle }: { showMiddle: boolean }) {
                return <GtkTextView ref={ref}>Start{showMiddle && " Middle"} End</GtkTextView>;
            }

            await render(<App showMiddle={true} />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Start Middle End");
        });

        it("renders with conditional TextTag", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ isBold }: { isBold: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        {isBold ? (
                            <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
                                Bold
                            </x.TextTag>
                        ) : (
                            "Normal"
                        )}
                    </GtkTextView>
                );
            }

            await render(<App isBold={true} />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Bold");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "bold", 0)).toBe(true);
        });
    });

    describe("callbacks", () => {
        it("does not call onTextChanged during React reconciliation", async () => {
            const ref = createRef<Gtk.TextView>();
            const onTextChanged = vi.fn();

            function App({ text }: { text: string }) {
                return (
                    <GtkTextView ref={ref} onTextChanged={onTextChanged}>
                        {text}
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App text="Initial" />);

            await rerender(<App text="Updated" />);

            expect(onTextChanged).not.toHaveBeenCalled();
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

            const buffer = ref.current?.getBuffer();
            expect(buffer?.getEnableUndo()).toBe(true);
        });

        it("disables undo when enableUndo is false", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref} enableUndo={false}>
                    Content
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(buffer?.getEnableUndo()).toBe(false);
        });
    });

    describe("mixed content order", () => {
        it("maintains correct text order with mixed content", async () => {
            const ref = createRef<Gtk.TextView>();

            await render(
                <GtkTextView ref={ref}>
                    Start{" "}
                    <x.TextTag id="tag1" foreground="red">
                        Red
                    </x.TextTag>{" "}
                    Middle{" "}
                    <x.TextTag id="tag2" foreground="blue">
                        Blue
                    </x.TextTag>{" "}
                    End
                </GtkTextView>,
            );

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Start Red Middle Blue End");

            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "tag1", 6)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "tag2", 18)).toBe(true);
        });

        it("handles mapped items with keys", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkTextView ref={ref}>
                        {items.map((item) => (
                            <x.TextTag key={item} id={item} foreground="blue">
                                {item}
                            </x.TextTag>
                        ))}
                    </GtkTextView>
                );
            }

            await render(<App items={["A", "B", "C"]} />);

            const buffer = ref.current?.getBuffer();
            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("ABC");

            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "A", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "B", 1)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "C", 2)).toBe(true);
        });
    });

    describe("dynamic updates - comprehensive", () => {
        it("updates text inside a tag and maintains subsequent tag offsets", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ innerText }: { innerText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <x.TextTag id="first" foreground="red">
                            {innerText}
                        </x.TextTag>
                        <x.TextTag id="second" foreground="blue">
                            Second
                        </x.TextTag>
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App innerText="Short" />);
            const buffer = ref.current?.getBuffer();

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("ShortSecond");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "second", 5)).toBe(true);

            await rerender(<App innerText="MuchLongerText" />);

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("MuchLongerTextSecond");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "first", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "second", 14)).toBe(true);
        });

        it("adds new tag dynamically", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ showTag }: { showTag: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        Start
                        {showTag && (
                            <x.TextTag id="dynamic" foreground="green">
                                New
                            </x.TextTag>
                        )}
                        End
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App showTag={false} />);
            const buffer = ref.current?.getBuffer();

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("StartEnd");

            await rerender(<App showTag={true} />);

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("StartNewEnd");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "dynamic", 5)).toBe(true);
        });

        it("removes tag dynamically", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ showTag }: { showTag: boolean }) {
                return (
                    <GtkTextView ref={ref}>
                        Start
                        {showTag && (
                            <x.TextTag id="removable" foreground="green">
                                Remove
                            </x.TextTag>
                        )}
                        End
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App showTag={true} />);
            const buffer = ref.current?.getBuffer();

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("StartRemoveEnd");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "removable", 5)).toBe(true);

            await rerender(<App showTag={false} />);

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("StartEnd");
        });

        it("reorders tags correctly", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ items }: { items: string[] }) {
                return (
                    <GtkTextView ref={ref}>
                        {items.map((item) => (
                            <x.TextTag key={item} id={item} foreground="blue">
                                {item}
                            </x.TextTag>
                        ))}
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App items={["A", "B", "C"]} />);
            const buffer = ref.current?.getBuffer();

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("ABC");

            await rerender(<App items={["C", "A", "B"]} />);

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("CAB");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "C", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "A", 1)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "B", 2)).toBe(true);
        });

        it("handles text change inside nested tag", async () => {
            const ref = createRef<Gtk.TextView>();

            function App({ innerText }: { innerText: string }) {
                return (
                    <GtkTextView ref={ref}>
                        <x.TextTag id="outer" foreground="blue">
                            Outer{" "}
                            <x.TextTag id="inner" weight={Pango.Weight.BOLD}>
                                {innerText}
                            </x.TextTag>
                        </x.TextTag>{" "}
                        After
                    </GtkTextView>
                );
            }

            const { rerender } = await render(<App innerText="Inner" />);
            const buffer = ref.current?.getBuffer();

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Outer Inner After");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "inner", 6)).toBe(true);

            await rerender(<App innerText="NestedText" />);

            expect(getBufferText(buffer as Gtk.TextBuffer)).toBe("Outer NestedText After");
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "outer", 0)).toBe(true);
            expect(hasTagAtOffset(buffer as Gtk.TextBuffer, "inner", 6)).toBe(true);
        });
    });
});
