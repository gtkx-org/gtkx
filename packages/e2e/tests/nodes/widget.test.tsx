import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkEntry, GtkImage, GtkLabel, GtkSwitch } from "@gtkx/react";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

describe("widget - creation", () => {
    describe("basic widgets", () => {
        it("creates Label widget with text", async () => {
            await render(<GtkLabel label="Hello World" />);

            const label = await screen.findByText("Hello World");
            expect(label).toBeDefined();
        });

        it("creates Button widget with label", async () => {
            await render(<GtkButton label="Click Me" />);

            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click Me" });
            expect(button).toBeDefined();
        });

        it("creates Box widget with orientation", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });

        it("creates Entry widget", async () => {
            await render(<GtkEntry placeholderText="Enter text" />);

            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(entry).toBeDefined();
        });

        it("creates Image widget", async () => {
            const ref = createRef<Gtk.Image>();

            await render(<GtkImage ref={ref} iconName="dialog-information" />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getIconName()).toBe("dialog-information");
        });
    });

    describe("constructor parameters", () => {
        it("passes constructor parameters from props", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} spacing={10} />);

            expect(ref.current?.getSpacing()).toBe(10);
        });

        it("handles widgets with no constructor parameters", async () => {
            const ref = createRef<Gtk.Button>();

            await render(<GtkButton ref={ref} />);

            expect(ref.current).not.toBeNull();
        });

        it("handles widgets with optional constructor parameters", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} />);

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ref access", () => {
        it("provides GTK widget via ref", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Test" />);

            expect(ref.current).not.toBeNull();
            expect(typeof ref.current?.getLabel).toBe("function");
        });

        it("ref.current is the actual GTK widget instance", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} label="Widget Instance" />);

            expect(ref.current?.handle).toBeDefined();
            expect(ref.current?.getLabel()).toBe("Widget Instance");
        });
    });

    describe("screen queries", () => {
        it("finds multiple buttons by role", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="First" />
                    <GtkButton label="Second" />
                    <GtkButton label="Third" />
                </GtkBox>,
            );

            const buttons = await screen.findAllByRole(Gtk.AccessibleRole.BUTTON);
            expect(buttons).toHaveLength(3);
        });

        it("finds button by name filter", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Submit" />
                    <GtkButton label="Cancel" />
                </GtkBox>,
            );

            const submitButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" });
            expect(submitButton).toBeDefined();

            const cancelButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Cancel" });
            expect(cancelButton).toBeDefined();
        });

        it("returns null for non-existent widget with queryBy", async () => {
            await render(<GtkButton label="Only Button" />);

            const nonExistent = screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(nonExistent).toBeNull();
        });

        it("finds widgets by text content", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="Welcome Message" />
                    <GtkLabel label="Description Text" />
                </GtkBox>,
            );

            const welcome = await screen.findByText("Welcome Message");
            expect(welcome).toBeDefined();

            const allLabels = await screen.findAllByText(/Message|Text/);
            expect(allLabels).toHaveLength(2);
        });

        it("uses regex for partial text matching", async () => {
            await render(<GtkLabel label="Error: Something went wrong" />);

            const errorLabel = await screen.findByText(/^Error:/);
            expect(errorLabel).toBeDefined();
        });
    });
});

describe("widget - props", () => {
    describe("property setting", () => {
        it("sets string properties", async () => {
            await render(<GtkLabel label="Test Label" />);

            const label = await screen.findByText("Test Label");
            expect(label).toBeDefined();
        });

        it("sets boolean properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} selectable={true} />);

            expect(ref.current?.getSelectable()).toBe(true);
        });

        it("sets numeric properties", async () => {
            const ref = createRef<Gtk.Label>();

            await render(<GtkLabel ref={ref} maxWidthChars={20} />);

            expect(ref.current?.getMaxWidthChars()).toBe(20);
        });

        it("sets enum properties", async () => {
            const ref = createRef<Gtk.Box>();

            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);

            expect(ref.current?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        });
    });

    describe("change detection", () => {
        it("skips update when value unchanged", async () => {
            function App() {
                return <GtkLabel label="Same" />;
            }

            const { rerender } = await render(<App />);

            const label = await screen.findByText("Same");
            expect(label).toBeDefined();

            await rerender(<App />);

            expect(screen.queryByText("Same")).not.toBeNull();
        });

        it("applies update when value changed", async () => {
            function App({ text }: { text: string }) {
                return <GtkLabel label={text} />;
            }

            const { rerender } = await render(<App text="Initial" />);
            await screen.findByText("Initial");

            await rerender(<App text="Updated" />);

            await waitFor(() => {
                expect(screen.queryByText("Updated")).not.toBeNull();
            });
        });

        it("handles undefined to value transition", async () => {
            function App({ label }: { label?: string }) {
                return <GtkLabel label={label} />;
            }

            const { rerender } = await render(<App label={undefined} />);

            await rerender(<App label="Now Set" />);

            await screen.findByText("Now Set");
        });

        it("handles value to undefined transition", async () => {
            const ref = createRef<Gtk.Label>();

            function App({ label }: { label?: string }) {
                return <GtkLabel ref={ref} label={label} />;
            }

            const { rerender } = await render(<App label="Has Value" />);
            await screen.findByText("Has Value");

            await rerender(<App label={undefined} />);
        });
    });

    describe("consumed props", () => {
        it("does not pass children prop to widget", async () => {
            const ref = createRef<Gtk.Box>();

            await render(
                <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL}>
                    Child
                </GtkBox>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("handles node-specific consumed props", async () => {
            await render(<GtkSwitch active={true} />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            expect(switchWidget).toBeDefined();
        });
    });

    describe("accessible state queries", () => {
        it("finds checkbox by checked state", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkCheckButton label="Unchecked" />
                    <GtkCheckButton label="Checked" active={true} />
                </GtkBox>,
            );

            const checkedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
            expect(checkedBox).toBeDefined();

            const uncheckedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
            expect(uncheckedBox).toBeDefined();
        });

        it("updates checkbox state after user interaction", async () => {
            await render(<GtkCheckButton label="Toggle Me" />);

            const checkbox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
            await userEvent.click(checkbox);

            await waitFor(() => {
                const checkedBox = screen.queryByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
                expect(checkedBox).not.toBeNull();
            });
        });

        it("finds switch by accessible role", async () => {
            await render(<GtkSwitch />);

            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            await userEvent.click(switchWidget);

            await waitFor(() => {
                expect((switchWidget as Gtk.Switch).getActive()).toBe(true);
            });
        });
    });
});

describe("widget - signals", () => {
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

            expect(handleStateSet).toHaveBeenCalledWith(true, expect.anything());
        });

        it("receives widget as last argument", async () => {
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

                expect(handlePressed).toHaveBeenCalled();
                const [nPress, x, y, event] = handlePressed.mock.calls[0] as [number, number, number, unknown];
                expect(typeof nPress).toBe("number");
                expect(typeof x).toBe("number");
                expect(typeof y).toBe("number");
                expect(event === null || typeof event === "object").toBe(true);
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
                expect(handleNotify).toHaveBeenCalledWith(expect.any(GObject.ParamSpec), expect.any(Gtk.Label));
            });
        });
    });
});
