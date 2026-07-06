import { AnimatePresence, animated } from "@gtkx/animate";
import { GtkBox } from "@gtkx/jsx/gtk";
import { render as baseRender, screen, waitFor } from "@gtkx/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const render = (element: ReactNode) => baseRender(element, { animations: true });

describe("AnimatePresence (exit gating)", () => {
    it("fires onExitComplete once after every exiting child finishes", async () => {
        const onExitComplete = vi.fn();

        function App({ items }: { items: string[] }) {
            return (
                <GtkBox>
                    <AnimatePresence onExitComplete={onExitComplete}>
                        {items.map((id) => (
                            <animated.GtkLabel
                                key={id}
                                label={id}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.05 }}
                            />
                        ))}
                    </AnimatePresence>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App items={["alpha", "beta"]} />);
        await screen.findByText("alpha");
        await screen.findByText("beta");

        await rerender(<App items={[]} />);

        await waitFor(() => expect(screen.queryByText("alpha")).toBeNull());
        await waitFor(() => expect(screen.queryByText("beta")).toBeNull());
        await waitFor(() => expect(onExitComplete).toHaveBeenCalled());
        expect(onExitComplete).toHaveBeenCalledTimes(1);
    });
});

describe("AnimatePresence (re-entry)", () => {
    it("re-animates a child that returns before its exit completes", async () => {
        const onAnimationStart = vi.fn();

        function App({ show }: { show: boolean }) {
            return (
                <GtkBox>
                    <AnimatePresence>
                        {show && (
                            <animated.GtkLabel
                                key="reenter"
                                label="Reenter"
                                initial={false}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                onAnimationStart={onAnimationStart}
                            />
                        )}
                    </AnimatePresence>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App show={true} />);
        await screen.findByText("Reenter");
        onAnimationStart.mockClear();

        await rerender(<App show={false} />);
        await rerender(<App show={true} />);

        await waitFor(() => expect(onAnimationStart).toHaveBeenCalledTimes(2));
        await screen.findByText("Reenter");
    });
});

describe("AnimatePresence (wait mode)", () => {
    it("holds the incoming child until the outgoing exit completes", async () => {
        function App({ id }: { id: string }) {
            return (
                <GtkBox>
                    <AnimatePresence mode="wait">
                        <animated.GtkLabel
                            key={id}
                            label={id}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                        />
                    </AnimatePresence>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App id="first" />);
        await screen.findByText("first");

        await rerender(<App id="second" />);

        expect(screen.queryByText("second")).toBeNull();
        expect(screen.queryByText("first")).not.toBeNull();

        await waitFor(() => expect(screen.queryByText("first")).toBeNull());
        await screen.findByText("second");
    });
});

describe("AnimatePresence (premature completion guard)", () => {
    it("does not fire onExitComplete early when a sibling re-renders mid-exit", async () => {
        const onExitComplete = vi.fn();

        function App({ items, tick }: { items: string[]; tick: number }) {
            return (
                <GtkBox>
                    <AnimatePresence onExitComplete={onExitComplete}>
                        {items.map((id) => (
                            <animated.GtkLabel
                                key={id}
                                label={id === "keep" ? `keep-${tick}` : id}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            />
                        ))}
                    </AnimatePresence>
                </GtkBox>
            );
        }

        const { rerender } = await render(<App items={["keep", "gone"]} tick={0} />);
        await screen.findByText("gone");

        await rerender(<App items={["keep"]} tick={0} />);
        await rerender(<App items={["keep"]} tick={1} />);
        await rerender(<App items={["keep"]} tick={2} />);

        expect(onExitComplete).not.toHaveBeenCalled();

        await waitFor(() => expect(onExitComplete).toHaveBeenCalledTimes(1));
    });
});
