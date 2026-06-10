import { render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { expect, vi } from "vitest";

/**
 * Builds a text-buffer view (such as `GtkTextView` or `GtkSourceView`) whose
 * buffer element has an `onChanged` callback wired up and the given text as
 * children.
 *
 * @param onChanged - Callback passed to the buffer element's `onChanged` prop.
 * @param text - Text rendered as the buffer element's children.
 */
export type BufferChangedViewBuilder = (onChanged: () => void, text: string) => ReactNode;

/**
 * Verifies that re-rendering a text-buffer view with new text does not invoke
 * the buffer's `onChanged` callback, confirming that React reconciliation
 * alone never reports a user-facing buffer change.
 *
 * @param build - Builds the view from an `onChanged` callback and text.
 */
export const expectNoBufferChangedOnReconcile = async (build: BufferChangedViewBuilder): Promise<void> => {
    const onChanged = vi.fn();

    const { rerender } = await render(build(onChanged, "Initial"));

    await rerender(build(onChanged, "Updated"));

    expect(onChanged).not.toHaveBeenCalled();
};
