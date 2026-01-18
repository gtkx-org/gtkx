import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import { GtkSourceView } from "@gtkx/react";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

const getBufferText = (buffer: GtkSource.Buffer): string => {
    const startIter = new Gtk.TextIter();
    const endIter = new Gtk.TextIter();

    batch(() => {
        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);
    });

    return buffer.getText(startIter, endIter, true);
};

describe("render - SourceView", () => {
    describe("basic rendering", () => {
        it("creates SourceView widget", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.handle).toBeDefined();
        });

        it("sets initial text content via children", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref}>Hello World</GtkSourceView>);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer).not.toBeNull();
            expect(getBufferText(buffer)).toBe("Hello World");
        });
    });

    describe("text content", () => {
        it("sets text via children", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref}>Initial content</GtkSourceView>);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(getBufferText(buffer)).toBe("Initial content");
        });

        it("updates text when children change", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ text }: { text: string }) {
                return <GtkSourceView ref={ref}>{text}</GtkSourceView>;
            }

            const { rerender } = await render(<App text="Initial" />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(getBufferText(buffer)).toBe("Initial");

            await rerender(<App text="Updated" />);
            expect(getBufferText(buffer)).toBe("Updated");
        });
    });

    describe("undo/redo support", () => {
        it("sets enableUndo property", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} enableUndo>
                    Content
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getEnableUndo()).toBe(true);
        });

        it("disables undo when enableUndo is false", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} enableUndo={false}>
                    Content
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getEnableUndo()).toBe(false);
        });

        it("calls onCanUndoChanged when undo state changes", async () => {
            const ref = createRef<GtkSource.View>();
            const onCanUndoChanged = vi.fn();

            await render(<GtkSourceView ref={ref} enableUndo onCanUndoChanged={onCanUndoChanged} />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;

            buffer.beginUserAction();
            buffer.insertAtCursor("text", -1);
            buffer.endUserAction();

            await waitFor(() => {
                expect(onCanUndoChanged).toHaveBeenCalled();
            });
        });

        it("calls onCanRedoChanged when redo state changes", async () => {
            const ref = createRef<GtkSource.View>();
            const onCanRedoChanged = vi.fn();

            await render(<GtkSourceView ref={ref} enableUndo onCanRedoChanged={onCanRedoChanged} />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;

            buffer.beginUserAction();
            buffer.insertAtCursor("text", -1);
            buffer.endUserAction();
            buffer.undo();

            await waitFor(() => {
                expect(onCanRedoChanged).toHaveBeenCalled();
            });
        });
    });

    describe("syntax highlighting", () => {
        it("sets language by string identifier", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} language="js">
                    const x = 1;
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            const language = buffer.getLanguage();
            expect(language?.getId()).toBe("js");
        });

        it("sets language by GtkSource.Language object", async () => {
            const ref = createRef<GtkSource.View>();
            const langManager = GtkSource.LanguageManager.getDefault();
            const jsLanguage = langManager.getLanguage("js");

            await render(
                <GtkSourceView ref={ref} language={jsLanguage as GtkSource.Language}>
                    const x = 1;
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            const language = buffer.getLanguage();
            expect(language?.getId()).toBe("js");
        });

        it("sets styleScheme by string identifier", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} styleScheme="classic">
                    text
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            const scheme = buffer.getStyleScheme();
            expect(scheme?.getId()).toBe("classic");
        });

        it("sets styleScheme by GtkSource.StyleScheme object", async () => {
            const ref = createRef<GtkSource.View>();
            const schemeManager = GtkSource.StyleSchemeManager.getDefault();
            const classicScheme = schemeManager.getScheme("classic");

            await render(
                <GtkSourceView ref={ref} styleScheme={classicScheme as GtkSource.StyleScheme}>
                    text
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            const scheme = buffer.getStyleScheme();
            expect(scheme?.getId()).toBe("classic");
        });

        it("sets highlightSyntax property", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} highlightSyntax>
                    text
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getHighlightSyntax()).toBe(true);
        });

        it("highlightSyntax defaults to true when language is set", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} language="js">
                    const x = 1;
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getHighlightSyntax()).toBe(true);
        });

        it("highlightSyntax can be explicitly disabled with language", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} language="js" highlightSyntax={false}>
                    const x = 1;
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getHighlightSyntax()).toBe(false);
        });
    });

    describe("additional buffer props", () => {
        it("sets highlightMatchingBrackets property", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} highlightMatchingBrackets={false}>
                    ()
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getHighlightMatchingBrackets()).toBe(false);
        });

        it("highlightMatchingBrackets defaults to true", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref}>()</GtkSourceView>);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getHighlightMatchingBrackets()).toBe(true);
        });

        it("sets implicitTrailingNewline property to false", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} implicitTrailingNewline={false}>
                    no newline
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getImplicitTrailingNewline()).toBe(false);
        });

        it("sets implicitTrailingNewline property to true", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} implicitTrailingNewline>
                    with newline
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getImplicitTrailingNewline()).toBe(true);
        });
    });

    describe("callbacks", () => {
        it("calls onTextChanged when text changes programmatically", async () => {
            const ref = createRef<GtkSource.View>();
            const onTextChanged = vi.fn();

            await render(<GtkSourceView ref={ref} onTextChanged={onTextChanged} />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            buffer.setText("New text", -1);

            await waitFor(() => {
                expect(onTextChanged).toHaveBeenCalledWith("New text");
            });
        });

        it("does not call onTextChanged during React reconciliation", async () => {
            const ref = createRef<GtkSource.View>();
            const onTextChanged = vi.fn();

            function App({ text }: { text: string }) {
                return (
                    <GtkSourceView ref={ref} onTextChanged={onTextChanged}>
                        {text}
                    </GtkSourceView>
                );
            }

            const { rerender } = await render(<App text="Initial" />);

            await rerender(<App text="Updated" />);

            expect(onTextChanged).not.toHaveBeenCalled();
        });

        it("calls onCursorMoved when cursor position changes", async () => {
            const ref = createRef<GtkSource.View>();
            const onCursorMoved = vi.fn();

            await render(
                <GtkSourceView ref={ref} onCursorMoved={onCursorMoved}>
                    Some text here
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            const iter = new Gtk.TextIter();
            buffer.getIterAtOffset(iter, 5);
            buffer.placeCursor(iter);

            await waitFor(() => {
                expect(onCursorMoved).toHaveBeenCalled();
            });
        });

        it("calls onHighlightUpdated when highlighting updates", async () => {
            const ref = createRef<GtkSource.View>();
            const onHighlightUpdated = vi.fn();

            await render(
                <GtkSourceView ref={ref} language="js" onHighlightUpdated={onHighlightUpdated}>
                    const x = 1;
                </GtkSourceView>,
            );

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            buffer.setText("function foo() { return 42; }", -1);

            await waitFor(() => {
                expect(onHighlightUpdated).toHaveBeenCalled();
            });
        });

        it("removes callback when set to null", async () => {
            const ref = createRef<GtkSource.View>();
            const onTextChanged = vi.fn();

            function App({ hasCallback }: { hasCallback: boolean }) {
                return <GtkSourceView ref={ref} onTextChanged={hasCallback ? onTextChanged : null} />;
            }

            const { rerender } = await render(<App hasCallback={true} />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;

            buffer.setText("Change 1", -1);
            await waitFor(() => {
                expect(onTextChanged).toHaveBeenCalled();
            });

            const callCountBeforeRemoval = onTextChanged.mock.calls.length;

            await rerender(<App hasCallback={false} />);

            buffer.setText("Change 2", -1);

            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(onTextChanged.mock.calls.length).toBe(callCountBeforeRemoval);
        });
    });

    describe("dynamic updates", () => {
        it("updates language when prop changes", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ lang }: { lang: string }) {
                return (
                    <GtkSourceView ref={ref} language={lang}>
                        code
                    </GtkSourceView>
                );
            }

            const { rerender } = await render(<App lang="js" />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getLanguage()?.getId()).toBe("js");

            await rerender(<App lang="python" />);
            expect(buffer.getLanguage()?.getId()).toBe("python");
        });

        it("updates styleScheme when prop changes", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ scheme }: { scheme: string }) {
                return (
                    <GtkSourceView ref={ref} styleScheme={scheme}>
                        code
                    </GtkSourceView>
                );
            }

            const { rerender } = await render(<App scheme="classic" />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getStyleScheme()?.getId()).toBe("classic");

            await rerender(<App scheme="tango" />);
            expect(buffer.getStyleScheme()?.getId()).toBe("tango");
        });

        it("removes language when set to undefined", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ lang }: { lang: string | undefined }) {
                return (
                    <GtkSourceView ref={ref} language={lang}>
                        code
                    </GtkSourceView>
                );
            }

            const { rerender } = await render(<App lang="js" />);

            const buffer = ref.current?.getBuffer() as GtkSource.Buffer;
            expect(buffer.getLanguage()?.getId()).toBe("js");

            await rerender(<App lang={undefined} />);
            expect(buffer.getLanguage()).toBeNull();
        });
    });
});
