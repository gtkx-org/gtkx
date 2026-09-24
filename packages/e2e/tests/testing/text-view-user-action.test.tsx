import type { ComponentProps } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTextBuffer, GtkTextView } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

type EditingHandlers = Pick<ComponentProps<typeof GtkTextView>, "onInsertAtCursor" | "onDeleteFromCursor">;
type ActionHandlers = Pick<ComponentProps<typeof GtkTextBuffer>, "onBeginUserAction" | "onEndUserAction">;
type EditMethod = "type" | "paste";

const renderEditor = async (
    handlers: EditingHandlers = {},
    actionHandlers: ActionHandlers = {},
): Promise<Gtk.TextView> => {
    await render(
        <GtkTextView
            name="editor"
            {...handlers}
            buffer={<GtkTextBuffer enableUndo text="abcd" {...actionHandlers} />}
        />,
    );
    const view = screen.getByName("editor", { as: Gtk.TextView });
    expect(view.getBuffer().getCanUndo()).toBe(false);

    return view;
};

const edit = async (
    view: Gtk.TextView,
    method: EditMethod,
    text: string,
    [start, end]: [number, number],
): Promise<void> => {
    const buffer = view.getBuffer();
    await act(() => {
        buffer.selectRange(buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
    });
    await userEvent[method](view, text);
};

const undo = async (view: Gtk.TextView, expected: string): Promise<void> => {
    const buffer = view.getBuffer();
    expect(buffer.getCanUndo()).toBe(true);
    await act(() => {
        buffer.undo();
    });
    expect(view).toHaveDisplayValue(expected);
};

const undoReplacement = async (view: Gtk.TextView, method: EditMethod): Promise<void> => {
    if (method === "type") {
        await undo(view, "ad");
    }
    await undo(view, "abcd");
    expect(view.getBuffer().getCanUndo()).toBe(false);
};

describe.each(["type", "paste"] as const)("TextView %s undo groups", (method) => {
    it("preserves selection replacement undo and redo groups", async () => {
        const view = await renderEditor();
        await edit(view, method, "X", [1, 3]);
        expect(view).toHaveDisplayValue("aXd");
        await undoReplacement(view, method);

        const buffer = view.getBuffer();
        const redoStates = method === "type" ? ["ad", "aXd"] : ["aXd"];
        for (const expected of redoStates) {
            expect(buffer.getCanRedo()).toBe(true);
            await act(() => {
                buffer.redo();
            });
            expect(view).toHaveDisplayValue(expected);
        }
        expect(buffer.getCanRedo()).toBe(false);
    });

    it("keeps one-character replacement in one undo group", async () => {
        const view = await renderEditor();
        await edit(view, method, "X", [1, 2]);
        expect(view).toHaveDisplayValue("aXcd");
        await undo(view, "abcd");
        expect(view.getBuffer().getCanUndo()).toBe(false);
    });

    it("leaves an empty edit out of undo history and accepts a later edit", async () => {
        const view = await renderEditor();
        await edit(view, method, "", [2, 2]);
        expect(view).toHaveDisplayValue("abcd");
        expect(view.getBuffer().getCanUndo()).toBe(false);
        await edit(view, method, "X", [2, 2]);
        expect(view).toHaveDisplayValue("abXcd");
        await undo(view, "abcd");
    });

    it("keeps completed insertion undoable when its handler throws", async () => {
        const inserted: string[] = [];
        const view = await renderEditor({
            onInsertAtCursor: (text) => {
                inserted.push(text);
                if (inserted.length === 1) {
                    throw new Error("Insertion observer failed");
                }
            },
        });

        await expect(edit(view, method, "X", [1, 3])).rejects.toThrow();
        expect(inserted).toEqual(["X"]);
        expect(view).toHaveDisplayValue("aXd");
        await undoReplacement(view, method);
        await edit(view, method, "Z", [2, 2]);
        expect(inserted).toEqual(["X", "Z"]);
        expect(view).toHaveDisplayValue("abZcd");
        await undo(view, "abcd");
    });

    it("keeps completed deletion undoable and stops the replacement after its handler throws", async () => {
        let deletions = 0;
        const inserted: string[] = [];
        const view = await renderEditor({
            onDeleteFromCursor: () => {
                deletions += 1;
                if (deletions === 1) {
                    throw new Error("Deletion observer failed");
                }
            },
            onInsertAtCursor: (text) => {
                inserted.push(text);
            },
        });

        await expect(edit(view, method, "X", [1, 3])).rejects.toThrow();
        expect(deletions).toBe(1);
        expect(inserted).toEqual([]);
        expect(view).toHaveDisplayValue("ad");
        await undo(view, "abcd");
        await edit(view, method, "Y", [1, 3]);
        expect(deletions).toBe(2);
        expect(inserted).toEqual(["Y"]);
        expect(view).toHaveDisplayValue("aYd");
        await undoReplacement(view, method);
    });
});

it("closes the empty action when its begin observer throws", async () => {
    let beginnings = 0;
    const view = await renderEditor({}, {
        onBeginUserAction: () => {
            beginnings += 1;
            if (beginnings === 1) {
                throw new Error("Begin observer failed");
            }
        },
    });

    await expect(edit(view, "type", "X", [2, 2])).rejects.toThrow();
    expect(beginnings).toBe(1);
    expect(view).toHaveDisplayValue("abcd");
    expect(view.getBuffer().getCanUndo()).toBe(false);
    await edit(view, "type", "Y", [2, 2]);
    expect(beginnings).toBe(2);
    expect(view).toHaveDisplayValue("abYcd");
    await undo(view, "abcd");
});

it("keeps a completed action undoable when its end observer throws", async () => {
    let endings = 0;
    const view = await renderEditor({}, {
        onEndUserAction: () => {
            endings += 1;
            if (endings === 1) {
                throw new Error("End observer failed");
            }
        },
    });

    await expect(edit(view, "type", "X", [2, 2])).rejects.toThrow();
    expect(endings).toBe(1);
    expect(view).toHaveDisplayValue("abXcd");
    await undo(view, "abcd");
    await edit(view, "type", "Y", [2, 2]);
    expect(endings).toBe(2);
    expect(view).toHaveDisplayValue("abYcd");
    await undo(view, "abcd");
});
