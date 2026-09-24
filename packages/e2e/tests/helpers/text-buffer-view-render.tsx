import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, vi } from "vitest";

type BufferChangedViewBuilder = (onChanged: () => void, text: string) => ReactNode;

const expectNoBufferChangedOnReconcile = async (build: BufferChangedViewBuilder): Promise<void> => {
    const onChanged = vi.fn();
    const { rerender } = await render(build(onChanged, "Initial"));
    const view = screen.getByRole(Gtk.AccessibleRole.TEXT_BOX);
    expect(view).toHaveDisplayValue("Initial");
    await rerender(build(onChanged, "Updated"));
    expect(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX)).toBe(view);
    expect(view).toHaveDisplayValue("Updated");
    expect(onChanged).not.toHaveBeenCalled();
    await userEvent.type(view, "?", { initialSelectionStart: 7 });
    expect(view).toHaveDisplayValue("Updated?");
    expect(onChanged).toHaveBeenCalled();
};

export { expectNoBufferChangedOnReconcile };
