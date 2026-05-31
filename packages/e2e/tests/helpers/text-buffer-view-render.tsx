import { render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { expect, vi } from "vitest";

/**
 * Builds a text-buffer view (such as `GtkTextView` or `GtkSourceView`) with an
 * `onBufferChanged` callback wired up and the given text as children.
 *
 * @param onBufferChanged - Callback passed to the view's `onBufferChanged` prop.
 * @param text - Text rendered as the view's children.
 */
export type BufferChangedViewBuilder = (onBufferChanged: () => void, text: string) => ReactNode;

/**
 * Verifies that re-rendering a text-buffer view with new text does not invoke
 * its `onBufferChanged` callback, confirming that React reconciliation alone
 * never reports a user-facing buffer change.
 *
 * @param build - Builds the view from an `onBufferChanged` callback and text.
 */
export const expectNoBufferChangedOnReconcile = async (build: BufferChangedViewBuilder): Promise<void> => {
    const onBufferChanged = vi.fn();

    const { rerender } = await render(build(onBufferChanged, "Initial"));

    await rerender(build(onBufferChanged, "Updated"));

    expect(onBufferChanged).not.toHaveBeenCalled();
};
