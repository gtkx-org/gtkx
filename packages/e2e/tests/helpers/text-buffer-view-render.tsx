import type { ReactNode } from "react";
import { render } from "@gtkx/testing";
import { expect, vi } from "vitest";

type BufferChangedViewBuilder = (onChanged: () => void, text: string) => ReactNode;

const expectNoBufferChangedOnReconcile = async (build: BufferChangedViewBuilder): Promise<void> => {
    const onChanged = vi.fn();
    const { rerender } = await render(build(onChanged, "Initial"));
    await rerender(build(onChanged, "Updated"));
    expect(onChanged).not.toHaveBeenCalled();
};

export { expectNoBufferChangedOnReconcile };
