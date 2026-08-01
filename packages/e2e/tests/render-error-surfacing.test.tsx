import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, rootElement } from "@gtkx/react";
import { createReconcilerRoot } from "@gtkx/react/internal";
import { Component, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

type BoundaryProps = { children: ReactNode };
type BoundaryState = { hasFailed: boolean };

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const Exploding = (): ReactNode => {
    throw new Error("render exploded");
};

class Boundary extends Component<BoundaryProps, BoundaryState> {
    public static getDerivedStateFromError(): BoundaryState {
        return { hasFailed: true };
    }

    public override state: BoundaryState = { hasFailed: false };

    public override render(): ReactNode {
        return this.state.hasFailed ? <GtkLabel>recovered</GtkLabel> : this.props.children;
    }
}

afterEach(() => {
    vi.restoreAllMocks();
});

it("logs a render error that an error boundary caught", async () => {
    const written = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const root = createRoot();

    root.render(
        <Boundary>
            <Exploding />
        </Boundary>,
    );

    await settle();
    root.unmount();
    const lines = written.mock.calls.map((call) => String(call[0])).join("");
    expect(lines).toContain("caught render error");
    expect(lines).toContain("render exploded");
});

it("drops a caught render error when no callbacks are wired", async () => {
    const written = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const root = createReconcilerRoot({ containerInfo: rootElement });

    root.update(
        <Boundary>
            <Exploding />
        </Boundary>,
    );

    await settle();

    await root.unmount((active) => {
        active.update(null);

        return Promise.resolve();
    });

    const lines = written.mock.calls.map((call) => String(call[0])).join("");
    expect(lines).not.toContain("render exploded");
});
