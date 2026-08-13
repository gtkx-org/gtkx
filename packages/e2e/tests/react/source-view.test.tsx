import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkSourceBuffer, type GtkSourceBufferProps, GtkSourceView } from "@gtkx/jsx/gtksource";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactElement, type ReactNode, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { getSourceBuffer } from "../helpers/buffer-text.js";
import { expectNoBufferChangedOnReconcile } from "../helpers/text-buffer-view-render.js";

const getLanguage = (id: string): GtkSource.Language | null => GtkSource.LanguageManager.getDefault().getLanguage(id);
const getScheme = (id: string): GtkSource.StyleScheme | null => GtkSource.StyleSchemeManager.getDefault().getScheme(id);

const buildLanguageSourceView = (
    ref: RefObject<GtkSource.View | null>,
    language: GtkSource.Language | null,
): ReactNode => <GtkSourceView ref={ref} buffer={<GtkSourceBuffer language={language}>code</GtkSourceBuffer>} />;

const renderSourceBuffer = async (buffer: ReactElement): Promise<GtkSource.Buffer> => {
    const ref = createRef<GtkSource.View>();
    await render(<GtkSourceView ref={ref} buffer={buffer} />);

    return getSourceBuffer(ref);
};

const renderJsLanguageSourceView = async (ref: RefObject<GtkSource.View | null>) => {
    const { rerender } = await render(buildLanguageSourceView(ref, getLanguage("js")));
    const buffer = getSourceBuffer(ref);
    expect(buffer.getLanguage()?.getId()).toBe("js");

    return { buffer, rerender };
};

const renderUndoableSourceViewAfterUserAction = async (
    ref: RefObject<GtkSource.View | null>,
    notify: Pick<GtkSourceBufferProps, "onNotifyCanUndo" | "onNotifyCanRedo">,
): Promise<GtkSource.Buffer> => {
    await render(<GtkSourceView ref={ref} buffer={<GtkSourceBuffer enableUndo {...notify} />} />);
    const buffer = getSourceBuffer(ref);
    await userEvent.type(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX), "text");

    return buffer;
};

describe("render - SourceView (1)", () => {
    describe("basic rendering", () => {
        it("creates SourceView widget", async () => {
            const ref = createRef<GtkSource.View>();
            await render(<GtkSourceView ref={ref} />);
            expect(ref.current).toBeRooted();
        });

        it("sets initial text content via buffer children", async () => {
            const buffer = await renderSourceBuffer(<GtkSourceBuffer>Hello World</GtkSourceBuffer>);
            expect(buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false)).toBe("Hello World");
            expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toHaveDisplayValue("Hello World");
        });
    });

    describe("text content", () => {
        it("throws for text directly under the view", async () => {
            await expect(render(<GtkSourceView>Initial content</GtkSourceView>)).rejects.toThrow(
                /must be rendered within a <GtkLabel> or <GtkTextBuffer>/,
            );
        });

        it("updates text when buffer children change", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ text }: { text: string }) {
                return <GtkSourceView ref={ref} buffer={<GtkSourceBuffer>{text}</GtkSourceBuffer>} />;
            }

            const { rerender } = await render(<App text="Initial" />);
            expect(ref.current).toHaveDisplayValue("Initial");
            await rerender(<App text="Updated" />);
            expect(ref.current).toHaveDisplayValue("Updated");
        });
    });
});

describe("render - SourceView (2)", () => {
    describe("undo/redo support (1)", () => {
        it.each([
            ["sets enableUndo property", true],
            ["disables undo when enableUndo is false", false],
        ])("%s", async (_title, enableUndo) => {
            const buffer = await renderSourceBuffer(<GtkSourceBuffer enableUndo={enableUndo}>Content</GtkSourceBuffer>);
            expect(buffer).toHaveObjectProperty("enableUndo", enableUndo);
        });

        it("calls onNotifyCanUndo when undo state changes", async () => {
            const ref = createRef<GtkSource.View>();
            const onNotifyCanUndo = vi.fn();
            await renderUndoableSourceViewAfterUserAction(ref, { onNotifyCanUndo });

            await waitFor(() => {
                expect(onNotifyCanUndo).toHaveBeenCalled();
            });
        });
    });
});

describe("render - SourceView (3)", () => {
    describe("undo/redo support (2)", () => {
        it("calls onNotifyCanRedo when redo state changes", async () => {
            const ref = createRef<GtkSource.View>();
            const onNotifyCanRedo = vi.fn();
            const buffer = await renderUndoableSourceViewAfterUserAction(ref, { onNotifyCanRedo });
            buffer.undo();

            await waitFor(() => {
                expect(onNotifyCanRedo).toHaveBeenCalled();
            });
        });
    });
});

describe("render - SourceView (4)", () => {
    describe("syntax highlighting (1)", () => {
        it("sets language on the buffer", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer language={getLanguage("js")}>const x = 1;</GtkSourceBuffer>,
            );

            expect(buffer.getLanguage()?.getId()).toBe("js");
        });

        it("sets styleScheme on the buffer", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer styleScheme={getScheme("classic")}>text</GtkSourceBuffer>,
            );

            expect(buffer.getStyleScheme()?.getId()).toBe("classic");
        });
    });
});

describe("render - SourceView (5)", () => {
    describe("syntax highlighting (2)", () => {
        it("sets highlightSyntax property", async () => {
            const buffer = await renderSourceBuffer(<GtkSourceBuffer highlightSyntax>text</GtkSourceBuffer>);
            expect(buffer).toHaveObjectProperty("highlightSyntax", true);
        });

        it("highlightSyntax can be explicitly disabled with language", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer language={getLanguage("js")} highlightSyntax={false}>
                    const x = 1;
                </GtkSourceBuffer>,
            );

            expect(buffer).toHaveObjectProperty("highlightSyntax", false);
        });
    });
});

describe("render - SourceView (7)", () => {
    describe("additional buffer props", () => {
        it("sets highlightMatchingBrackets property", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer highlightMatchingBrackets={false}>()</GtkSourceBuffer>,
            );

            expect(buffer).toHaveObjectProperty("highlightMatchingBrackets", false);
        });

        it("highlightMatchingBrackets defaults to true", async () => {
            const buffer = await renderSourceBuffer(<GtkSourceBuffer>()</GtkSourceBuffer>);
            expect(buffer).toHaveObjectProperty("highlightMatchingBrackets", true);
        });

        it("sets implicitTrailingNewline property to false", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer implicitTrailingNewline={false}>no newline</GtkSourceBuffer>,
            );

            expect(buffer).toHaveObjectProperty("implicitTrailingNewline", false);
        });

        it("sets implicitTrailingNewline property to true", async () => {
            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer implicitTrailingNewline>with newline</GtkSourceBuffer>,
            );

            expect(buffer).toHaveObjectProperty("implicitTrailingNewline", true);
        });
    });
});

describe("render - SourceView (8)", () => {
    describe("callbacks (1)", () => {
        it("calls onChanged when text changes programmatically", async () => {
            const onChanged = vi.fn();
            const buffer = await renderSourceBuffer(<GtkSourceBuffer onChanged={onChanged} />);
            buffer.setText("New text", -1);

            await waitFor(() => {
                expect(onChanged).toHaveBeenCalledWith(buffer);
            });
        });

        it("does not call onChanged during React reconciliation", async () => {
            await expectNoBufferChangedOnReconcile((onChanged, text) => (
                <GtkSourceView buffer={<GtkSourceBuffer onChanged={onChanged}>{text}</GtkSourceBuffer>} />
            ));
        });
    });
});

describe("render - SourceView (9)", () => {
    describe("callbacks (2)", () => {
        it("calls onCursorMoved when cursor position changes", async () => {
            const onCursorMoved = vi.fn();

            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer onCursorMoved={onCursorMoved}>Some text here</GtkSourceBuffer>,
            );

            const iter = buffer.getIterAtOffset(5);
            buffer.placeCursor(iter);

            await waitFor(() => {
                expect(onCursorMoved).toHaveBeenCalled();
            });
        });

        it("calls onHighlightUpdated when highlighting updates", async () => {
            const onHighlightUpdated = vi.fn();

            const buffer = await renderSourceBuffer(
                <GtkSourceBuffer language={getLanguage("js")} onHighlightUpdated={onHighlightUpdated}>
                    const x = 1;
                </GtkSourceBuffer>,
            );

            buffer.setText("function foo() { return 42; }", -1);

            await waitFor(() => {
                expect(onHighlightUpdated).toHaveBeenCalled();
            });
        });
    });
});

describe("render - SourceView (10)", () => {
    describe("callbacks (3)", () => {
        it("removes callback when set to null", async () => {
            const ref = createRef<GtkSource.View>();
            const onChanged = vi.fn();

            function App({ hasCallback }: { hasCallback: boolean }) {
                return (
                    <GtkSourceView
                        ref={ref}
                        buffer={<GtkSourceBuffer onChanged={hasCallback ? onChanged : undefined} />}
                    />
                );
            }

            const { rerender } = await render(<App hasCallback={true} />);
            const buffer = getSourceBuffer(ref);
            buffer.setText("Change 1", -1);

            await waitFor(() => {
                expect(onChanged).toHaveBeenCalled();
            });

            const callCountBeforeRemoval = onChanged.mock.calls.length;
            await rerender(<App hasCallback={false} />);
            buffer.setText("Change 2", -1);
            await new Promise((resolve) => setTimeout(resolve, 50));
            expect(onChanged.mock.calls).toHaveLength(callCountBeforeRemoval);
        });
    });
});

describe("render - SourceView (11)", () => {
    describe("dynamic updates (1)", () => {
        it("updates language when prop changes", async () => {
            const ref = createRef<GtkSource.View>();
            const { buffer, rerender } = await renderJsLanguageSourceView(ref);
            await rerender(buildLanguageSourceView(ref, getLanguage("python")));
            expect(buffer.getLanguage()?.getId()).toBe("python");
        });

        it("updates styleScheme when prop changes", async () => {
            const ref = createRef<GtkSource.View>();

            function App({ scheme }: { scheme: GtkSource.StyleScheme | null }) {
                return (
                    <GtkSourceView ref={ref} buffer={<GtkSourceBuffer styleScheme={scheme}>code</GtkSourceBuffer>} />
                );
            }

            const { rerender } = await render(<App scheme={getScheme("classic")} />);
            const buffer = getSourceBuffer(ref);
            expect(buffer.getStyleScheme()?.getId()).toBe("classic");
            await rerender(<App scheme={getScheme("tango")} />);
            expect(buffer.getStyleScheme()?.getId()).toBe("tango");
        });
    });
});

describe("render - SourceView (12)", () => {
    describe("dynamic updates (2)", () => {
        it("removes language when set to null", async () => {
            const ref = createRef<GtkSource.View>();
            const { buffer, rerender } = await renderJsLanguageSourceView(ref);
            await rerender(buildLanguageSourceView(ref, null));
            expect(buffer.getLanguage()).toBeNull();
        });
    });
});
