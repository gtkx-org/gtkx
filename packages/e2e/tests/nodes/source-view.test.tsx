import * as Gtk from "@gtkx/gi/gtk";
import * as GtkSource from "@gtkx/gi/gtksource";
import { GtkSourceBuffer, type GtkSourceBufferProps, GtkSourceView } from "@gtkx/jsx/gtksource";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { getSourceBuffer } from "../helpers/buffer-text.js";
import { expectNoBufferChangedOnReconcile } from "../helpers/text-buffer-view-render.js";

const getLanguage = (id: string): GtkSource.Language | null => GtkSource.LanguageManager.getDefault().getLanguage(id);

const getScheme = (id: string): GtkSource.StyleScheme | null => GtkSource.StyleSchemeManager.getDefault().getScheme(id);

const buildLanguageSourceView = (
    ref: RefObject<GtkSource.View | null>,
    language: GtkSource.Language | null,
): ReactNode => <GtkSourceView ref={ref} buffer={<GtkSourceBuffer language={language}>code</GtkSourceBuffer>} />;

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

            expect(ref.current).not.toBeNull();
            expect(ref.current).toBeDefined();
        });

        it("sets initial text content via buffer children", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref} buffer={<GtkSourceBuffer>Hello World</GtkSourceBuffer>} />);

            const buffer = getSourceBuffer(ref);
            expect(buffer).not.toBeNull();
            expect(screen.getByDisplayValue("Hello World")).toBeDefined();
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

            expect(screen.getByDisplayValue("Initial")).toBeDefined();

            await rerender(<App text="Updated" />);
            expect(screen.getByDisplayValue("Updated")).toBeDefined();
        });
    });
});

describe("render - SourceView (2)", () => {
    describe("undo/redo support (1)", () => {
        it.each([
            ["sets enableUndo property", true],
            ["disables undo when enableUndo is false", false],
        ])("%s", async (_title, enableUndo) => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView ref={ref} buffer={<GtkSourceBuffer enableUndo={enableUndo}>Content</GtkSourceBuffer>} />,
            );

            const buffer = getSourceBuffer(ref);
            expect(buffer.getEnableUndo()).toBe(enableUndo);
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
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer language={getLanguage("js")}>const x = 1;</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            const language = buffer.getLanguage();
            expect(language?.getId()).toBe("js");
        });

        it("sets styleScheme on the buffer", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer styleScheme={getScheme("classic")}>text</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            const scheme = buffer.getStyleScheme();
            expect(scheme?.getId()).toBe("classic");
        });
    });
});

describe("render - SourceView (5)", () => {
    describe("syntax highlighting (2)", () => {
        it("sets highlightSyntax property", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref} buffer={<GtkSourceBuffer highlightSyntax>text</GtkSourceBuffer>} />);

            const buffer = getSourceBuffer(ref);
            expect(buffer.getHighlightSyntax()).toBe(true);
        });

        it("highlightSyntax can be explicitly disabled with language", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={
                        <GtkSourceBuffer language={getLanguage("js")} highlightSyntax={false}>
                            const x = 1;
                        </GtkSourceBuffer>
                    }
                />,
            );

            const buffer = getSourceBuffer(ref);
            expect(buffer.getHighlightSyntax()).toBe(false);
        });
    });
});

describe("render - SourceView (7)", () => {
    describe("additional buffer props", () => {
        it("sets highlightMatchingBrackets property", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer highlightMatchingBrackets={false}>()</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            expect(buffer.getHighlightMatchingBrackets()).toBe(false);
        });

        it("highlightMatchingBrackets defaults to true", async () => {
            const ref = createRef<GtkSource.View>();

            await render(<GtkSourceView ref={ref} buffer={<GtkSourceBuffer>()</GtkSourceBuffer>} />);

            const buffer = getSourceBuffer(ref);
            expect(buffer.getHighlightMatchingBrackets()).toBe(true);
        });

        it("sets implicitTrailingNewline property to false", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer implicitTrailingNewline={false}>no newline</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            expect(buffer.getImplicitTrailingNewline()).toBe(false);
        });

        it("sets implicitTrailingNewline property to true", async () => {
            const ref = createRef<GtkSource.View>();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer implicitTrailingNewline>with newline</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            expect(buffer.getImplicitTrailingNewline()).toBe(true);
        });
    });
});

describe("render - SourceView (8)", () => {
    describe("callbacks (1)", () => {
        it("calls onChanged when text changes programmatically", async () => {
            const ref = createRef<GtkSource.View>();
            const onChanged = vi.fn();

            await render(<GtkSourceView ref={ref} buffer={<GtkSourceBuffer onChanged={onChanged} />} />);

            const buffer = getSourceBuffer(ref);
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
            const ref = createRef<GtkSource.View>();
            const onCursorMoved = vi.fn();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={<GtkSourceBuffer onCursorMoved={onCursorMoved}>Some text here</GtkSourceBuffer>}
                />,
            );

            const buffer = getSourceBuffer(ref);
            const iter = buffer.getIterAtOffset(5);
            buffer.placeCursor(iter);

            await waitFor(() => {
                expect(onCursorMoved).toHaveBeenCalled();
            });
        });

        it("calls onHighlightUpdated when highlighting updates", async () => {
            const ref = createRef<GtkSource.View>();
            const onHighlightUpdated = vi.fn();

            await render(
                <GtkSourceView
                    ref={ref}
                    buffer={
                        <GtkSourceBuffer language={getLanguage("js")} onHighlightUpdated={onHighlightUpdated}>
                            const x = 1;
                        </GtkSourceBuffer>
                    }
                />,
            );

            const buffer = getSourceBuffer(ref);
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
            expect(onChanged.mock.calls.length).toBe(callCountBeforeRemoval);
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
