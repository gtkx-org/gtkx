import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkEntry, GtkLabel, GtkSwitch } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

describe("render - signals", () => {
    describe("connection", () => {
        it("connects onClicked handler to clicked signal", async () => {
            const handleClick = vi.fn();

            await render(<GtkButton onClicked={handleClick} label="Click" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });
            await userEvent.click(button);

            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it("connects onActivate handler to activate signal", async () => {
            const handleActivate = vi.fn();

            await render(<GtkEntry onActivate={handleActivate} placeholderText="Search" />);

            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            await userEvent.keyboard(entry, "{Enter}");

            expect(handleActivate).toHaveBeenCalledTimes(1);
        });

        it("connects onStateSet handler to state-set signal", async () => {
            const handleStateSet = vi.fn(() => false);

            await render(<GtkSwitch onStateSet={handleStateSet} />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            await userEvent.click(switchWidget);

            expect(handleStateSet).toHaveBeenCalledTimes(1);
        });
    });

    describe("disconnection", () => {
        it("disconnects handler when prop removed", async () => {
            const handleClick = vi.fn();

            function App({ hasHandler }: { hasHandler: boolean }) {
                return <GtkButton onClicked={hasHandler ? handleClick : undefined} label="Click" />;
            }

            const { rerender } = await render(<App hasHandler={true} />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });
            await userEvent.click(button);
            expect(handleClick).toHaveBeenCalledTimes(1);

            await rerender(<App hasHandler={false} />);

            await userEvent.click(button);
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it("disconnects handler when widget unmounted", async () => {
            const handleClick = vi.fn();

            function App({ showButton }: { showButton: boolean }) {
                return showButton ? <GtkButton onClicked={handleClick} label="Click" /> : null;
            }

            const { rerender } = await render(<App showButton={true} />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });
            await userEvent.click(button);
            expect(handleClick).toHaveBeenCalledTimes(1);

            await rerender(<App showButton={false} />);

            expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
        });
    });

    describe("updates", () => {
        it("replaces handler when function reference changes", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            function App({ useHandler1 }: { useHandler1: boolean }) {
                return <GtkButton onClicked={useHandler1 ? handler1 : handler2} label="Click" />;
            }

            const { rerender } = await render(<App useHandler1={true} />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });
            await userEvent.click(button);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).not.toHaveBeenCalled();

            await rerender(<App useHandler1={false} />);

            await userEvent.click(button);
            expect(handler1).toHaveBeenCalledTimes(1);
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it("maintains handler when function reference is stable", async () => {
            const handleClick = vi.fn();

            function App({ label }: { label: string }) {
                return <GtkButton onClicked={handleClick} label={label} />;
            }

            const { rerender } = await render(<App label="First" />);

            await rerender(<App label="Second" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
            await userEvent.click(button);
            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    describe("signal arguments", () => {
        it("receives signal arguments in callback", async () => {
            const handleStateSet = vi.fn(() => false);

            await render(<GtkSwitch onStateSet={handleStateSet} />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            await userEvent.click(switchWidget);

            expect(handleStateSet).toHaveBeenCalledWith(expect.anything(), true);
        });

        it("receives widget as first argument", async () => {
            const handleClick = vi.fn();
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} onClicked={handleClick} label="Click" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });
            await userEvent.click(button);

            expect(handleClick).toHaveBeenCalledWith(ref.current);
        });
    });

    describe("user interactions with waitFor", () => {
        it("waits for state update after click", async () => {
            function Counter() {
                const [count, setCount] = useState(0);
                return <GtkButton onClicked={() => setCount((c) => c + 1)} label={`Count: ${count}`} />;
            }

            await render(<Counter />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Count: 0" });
            await userEvent.click(button);

            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Count: 1" })).not.toBeNull();
            });
        });

        it("handles multiple rapid clicks", async () => {
            function Counter() {
                const [count, setCount] = useState(0);
                return <GtkButton onClicked={() => setCount((c) => c + 1)} label={`Clicks: ${count}`} />;
            }

            await render(<Counter />);

            let button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 0" });

            await userEvent.click(button);
            button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 1" });

            await userEvent.click(button);
            button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 2" });

            await userEvent.click(button);
            await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 3" });
        });
    });

    describe("event controllers", () => {
        describe("motion controller", () => {
            it("connects onEnter handler", async () => {
                const handleEnter = vi.fn();

                await render(<GtkButton onEnter={handleEnter} label="Hover Me" />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);

                expect(handleEnter).toHaveBeenCalledTimes(1);
            });

            it("connects onLeave handler", async () => {
                const handleLeave = vi.fn();

                await render(<GtkButton onLeave={handleLeave} label="Hover Me" />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);
                await userEvent.unhover(button);

                expect(handleLeave).toHaveBeenCalledTimes(1);
            });

            it("disconnects motion handlers when removed", async () => {
                const handleEnter = vi.fn();

                function App({ hasHandler }: { hasHandler: boolean }) {
                    return <GtkButton onEnter={hasHandler ? handleEnter : undefined} label="Hover" />;
                }

                const { rerender } = await render(<App hasHandler={true} />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover" });
                await userEvent.hover(button);
                expect(handleEnter).toHaveBeenCalledTimes(1);

                await rerender(<App hasHandler={false} />);

                await userEvent.unhover(button);
                await userEvent.hover(button);
                expect(handleEnter).toHaveBeenCalledTimes(1);
            });
        });

        describe("click controller", () => {
            it("connects onPressed handler", async () => {
                const handlePressed = vi.fn();

                await render(<GtkButton onPressed={handlePressed} label="Press Me" />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press Me" });
                await userEvent.pointer(button, "down");

                expect(handlePressed).toHaveBeenCalledTimes(1);
            });

            it("connects onReleased handler", async () => {
                const handleReleased = vi.fn();

                await render(<GtkButton onReleased={handleReleased} label="Release Me" />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Release Me" });
                await userEvent.pointer(button, "click");

                expect(handleReleased).toHaveBeenCalledTimes(1);
            });

            it("passes coordinates to press handler", async () => {
                const handlePressed = vi.fn();

                await render(<GtkButton onPressed={handlePressed} label="Press" />);

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press" });
                await userEvent.pointer(button, "down");

                expect(handlePressed).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number));
            });
        });

        describe("key controller", () => {
            it("connects onKeyPressed handler", async () => {
                const handleKeyPressed = vi.fn(() => false);

                await render(<GtkEntry onKeyPressed={handleKeyPressed} placeholderText="Type here" />);

                const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
                await userEvent.keyboard(entry, "a");

                expect(handleKeyPressed).toHaveBeenCalled();
            });

            it("connects onKeyReleased handler", async () => {
                const handleKeyReleased = vi.fn(() => false);

                await render(<GtkEntry onKeyReleased={handleKeyReleased} placeholderText="Type here" />);

                const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
                await userEvent.keyboard(entry, "a");

                expect(handleKeyReleased).toHaveBeenCalled();
            });

            it("disconnects key handlers when removed", async () => {
                const handleKeyPressed = vi.fn(() => false);

                function App({ hasHandler }: { hasHandler: boolean }) {
                    return <GtkEntry onKeyPressed={hasHandler ? handleKeyPressed : undefined} placeholderText="Test" />;
                }

                const { rerender } = await render(<App hasHandler={true} />);

                const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
                await userEvent.keyboard(entry, "a");
                expect(handleKeyPressed).toHaveBeenCalledTimes(1);

                await rerender(<App hasHandler={false} />);

                await userEvent.keyboard(entry, "b");
                expect(handleKeyPressed).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("onNotify", () => {
        it("connects onNotify handler for property changes", async () => {
            const handleNotify = vi.fn();
            const ref = createRef<Gtk.Label>();

            function App({ text }: { text: string }) {
                return <GtkLabel ref={ref} label={text} onNotify={handleNotify} />;
            }

            await render(<App text="Initial" />);

            await render(<App text="Updated" />);

            await waitFor(() => {
                expect(handleNotify).toHaveBeenCalled();
            });
        });

        it("receives widget and property name in callback", async () => {
            const handleNotify = vi.fn();

            function App({ text }: { text: string }) {
                return <GtkLabel label={text} onNotify={handleNotify} />;
            }

            await render(<App text="Initial" />);

            await waitFor(() => {
                expect(handleNotify).toHaveBeenCalledWith(expect.anything(), expect.any(String));
            });
        });
    });
});
