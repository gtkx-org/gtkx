import type { ComponentProps, ReactNode } from "react";
import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAboutDialog,
    GtkApplication,
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkEventControllerKey,
    GtkEventControllerMotion,
    GtkFlowBox,
    GtkGestureClick,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkSwitch,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement } from "@gtkx/react";
import { render as baseRender, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";
import { createAppIdFactory } from "../helpers/unique-name.js";

const uniqueAppId = createAppIdFactory("org.gtkx.widgettest");

const render = (element: ReactNode) => baseRender(element);

const labelCount = (container: Gtk.Widget | null): number => {
    if (container === null) {
        throw new Error("expected a mounted container");
    }

    return within(container).getAllByRole(Gtk.AccessibleRole.LABEL).length;
};

const findClickButton = () => screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });

const expectClickCallCount = async (button: Gtk.Widget, handler: Mock, times: number): Promise<void> => {
    await userEvent.click(button);

    await waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(times);
    });
};

const renderClickButtonAndClick = async (): Promise<Mock> => {
    const handleClick = vi.fn();
    await render(<GtkButton onClicked={handleClick} label="Click" />);
    const button = await findClickButton();
    await userEvent.click(button);

    return handleClick;
};

const renderSwitchAndClick = async (props: ComponentProps<typeof GtkSwitch>): Promise<Gtk.Widget> => {
    await render(<GtkSwitch {...props} />);
    const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
    await userEvent.click(switchWidget);

    return switchWidget;
};

const labelItems = (items: string[]): ReactNode => items.map((item) => <GtkLabel key={item}>{item}</GtkLabel>);

function SameLabel() {
    return <GtkLabel label="Same" />;
}

function TextLabel({ text }: { text: string }) {
    return <GtkLabel label={text} />;
}

function OptionalLabel({ label }: { label?: string | undefined }) {
    return <GtkLabel label={label} />;
}

function CountingButton({ prefix }: { prefix: string }) {
    const [count, setCount] = useState(0);

    return (
        <GtkButton
            onClicked={() => {
                setCount((c) => c + 1);
            }}
            label={`${prefix}: ${String(count)}`}
        />
    );
}

function LabelListBox({ items }: { items: string[] }) {
    return <GtkListBox>{labelItems(items)}</GtkListBox>;
}

function LabelList({ count }: { count: number }) {
    return (
        <GtkBox>
            {Array.from({ length: count }, (_, i) => (
                <GtkLabel key={`label-${String(i)}`}>
                    Label
                    {i}
                </GtkLabel>
            ))}
        </GtkBox>
    );
}

function ClickButton({ onClicked }: { onClicked?: (() => void) | undefined }) {
    return <GtkButton onClicked={onClicked} label="Click" />;
}

function OptionalClickButton({ onClicked, mounted }: { onClicked: () => void; mounted: boolean }) {
    return mounted ? <GtkButton onClicked={onClicked} label="Click" /> : null;
}

const renderInApp = (window: ReactNode) =>
    baseRender(
        <GtkApplication applicationId={uniqueAppId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            {window}
        </GtkApplication>,
        { container: rootElement },
    );

describe("widget - creation (1)", () => {
    describe("basic widgets", () => {
        it("creates Label widget with text", async () => {
            await render(<GtkLabel>Hello World</GtkLabel>);
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
});

describe("widget - creation (2)", () => {
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
            await render(<GtkLabel ref={ref}>Test</GtkLabel>);
            expect(ref.current).not.toBeNull();
            expect(typeof ref.current?.getLabel).toBe("function");
        });

        it("ref.current is the actual GTK widget instance", async () => {
            const ref = createRef<Gtk.Label>();
            await render(<GtkLabel ref={ref}>Widget Instance</GtkLabel>);
            expect(ref.current).toBeDefined();
            expect(ref.current?.getLabel()).toBe("Widget Instance");
        });
    });
});

describe("widget - creation (3)", () => {
    describe("screen queries (1)", () => {
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
    });
});

describe("widget - creation (4)", () => {
    describe("screen queries (2)", () => {
        it("finds widgets by text content", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Welcome Message" />
                    <GtkButton label="Description Text" />
                </GtkBox>,
            );

            const welcome = await screen.findByText("Welcome Message");
            expect(welcome).toBeDefined();
            const allButtons = await screen.findAllByText(/Message|Text/);
            expect(allButtons).toHaveLength(2);
        });

        it("uses regex for partial text matching", async () => {
            await render(<GtkLabel>Error: Something went wrong</GtkLabel>);
            const errorLabel = await screen.findByText(/^Error:/);
            expect(errorLabel).toBeDefined();
        });
    });
});

describe("widget - props (1)", () => {
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
});

describe("widget - props (2)", () => {
    describe("change detection (1)", () => {
        it("skips update when value unchanged", async () => {
            const { rerender } = await render(<SameLabel />);
            const label = await screen.findByText("Same");
            expect(label).toBeDefined();
            await rerender(<SameLabel />);
            expect(screen.queryByText("Same")).not.toBeNull();
        });

        it("applies update when value changed", async () => {
            const { rerender } = await render(<TextLabel text="Initial" />);
            await screen.findByText("Initial");
            await rerender(<TextLabel text="Updated" />);

            await waitFor(() => {
                expect(screen.queryByText("Updated")).not.toBeNull();
            });
        });

        it("handles undefined to value transition", async () => {
            const { rerender } = await render(<OptionalLabel label={undefined} />);
            await rerender(<OptionalLabel label="Now Set" />);
            expect(await screen.findByText("Now Set")).toBeDefined();
        });
    });
});

describe("widget - props (3)", () => {
    describe("change detection (2)", () => {
        it("preserves the last-set value when a prop transitions to undefined", async () => {
            const { rerender } = await render(<OptionalLabel label="Has Value" />);
            await screen.findByText("Has Value");
            await rerender(<OptionalLabel label={undefined} />);
            expect(screen.getByText("Has Value")).toBeDefined();
        });
    });

    describe("consumed props", () => {
        it("does not pass children prop to widget", async () => {
            const ref = createRef<Gtk.Box>();

            await render(
                <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel>Child</GtkLabel>
                </GtkBox>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("applies the active prop to GtkSwitch", async () => {
            await render(<GtkSwitch active={true} />);
            const switchWidget = await screen.findByRole(Gtk.AccessibleRole.SWITCH);
            expect(switchWidget).toBeDefined();
        });
    });
});

describe("widget - props (4)", () => {
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
            await renderSwitchAndClick({});

            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.SWITCH, { checked: true })).not.toBeNull();
            });
        });
    });
});

describe("widget - signals (1)", () => {
    describe("connection", () => {
        it("connects onClicked handler to clicked signal", async () => {
            const handleClick = await renderClickButtonAndClick();

            await waitFor(() => {
                expect(handleClick).toHaveBeenCalledTimes(1);
            });
        });

        it("connects onActivate handler to activate signal", async () => {
            const handleActivate = vi.fn();
            await render(<GtkEntry onActivate={handleActivate} placeholderText="Search" />);
            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            await userEvent.keyboard(entry, "{Enter}");
            expect(handleActivate).toHaveBeenCalledTimes(1);
        });

        it("connects onStateSet handler to state-set signal", async () => {
            const handleStateSet = vi.fn(() => Gdk.EVENT_PROPAGATE);
            await renderSwitchAndClick({ onStateSet: handleStateSet });

            await waitFor(() => {
                expect(handleStateSet).toHaveBeenCalledTimes(1);
            });
        });
    });
});

describe("widget - signals (2)", () => {
    describe("disconnection", () => {
        it("disconnects handler when prop removed", async () => {
            const handleClick = vi.fn();
            const { rerender } = await render(<ClickButton onClicked={handleClick} />);
            const button = await findClickButton();
            await expectClickCallCount(button, handleClick, 1);
            await rerender(<ClickButton />);
            await expectClickCallCount(button, handleClick, 1);
        });

        it("disconnects handler when widget unmounted", async () => {
            const handleClick = vi.fn();
            const { rerender } = await render(<OptionalClickButton onClicked={handleClick} mounted={true} />);
            const button = await findClickButton();
            await expectClickCallCount(button, handleClick, 1);
            await rerender(<OptionalClickButton onClicked={handleClick} mounted={false} />);
            expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
        });
    });
});

describe("widget - signals (3)", () => {
    describe("updates", () => {
        it("replaces handler when function reference changes", async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            function App({ useHandler1 }: { useHandler1: boolean }) {
                return <GtkButton onClicked={useHandler1 ? handler1 : handler2} label="Click" />;
            }

            const { rerender } = await render(<App useHandler1={true} />);
            const button = await findClickButton();
            await expectClickCallCount(button, handler1, 1);
            expect(handler2).not.toHaveBeenCalled();
            await rerender(<App useHandler1={false} />);
            await expectClickCallCount(button, handler2, 1);
            expect(handler1).toHaveBeenCalledTimes(1);
        });

        it("maintains handler when function reference is stable", async () => {
            const handleClick = vi.fn();

            function App({ label }: { label: string }) {
                return <GtkButton onClicked={handleClick} label={label} />;
            }

            const { rerender } = await render(<App label="First" />);
            await rerender(<App label="Second" />);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
            await expectClickCallCount(button, handleClick, 1);
        });
    });
});

describe("widget - signals (4)", () => {
    describe("signal arguments", () => {
        it("receives signal arguments in callback", async () => {
            const handleStateSet = vi.fn(() => Gdk.EVENT_PROPAGATE);
            await renderSwitchAndClick({ onStateSet: handleStateSet });

            await waitFor(() => {
                expect(handleStateSet).toHaveBeenCalledWith(true, expect.any(Gtk.Switch));
            });
        });

        it("invokes the parameterless handler with the source widget", async () => {
            const handleClick = await renderClickButtonAndClick();

            await waitFor(() => {
                expect(handleClick).toHaveBeenCalledWith(expect.any(Gtk.Button));
            });
        });
    });
});

describe("widget - signals (5)", () => {
    describe("user interactions with waitFor", () => {
        it("waits for state update after click", async () => {
            await render(<CountingButton prefix="Count" />);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Count: 0" });
            await userEvent.click(button);

            await waitFor(() => {
                expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Count: 1" })).not.toBeNull();
            });
        });

        it("handles multiple rapid clicks", async () => {
            await render(<CountingButton prefix="Clicks" />);
            let button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 0" });
            await userEvent.click(button);
            button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 1" });
            await userEvent.click(button);
            button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 2" });
            await userEvent.click(button);
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 3" })).toBeDefined();
        });
    });
});

describe("widget - signals (6)", () => {
    describe("event controllers (1)", () => {
        describe("motion controller (1)", () => {
            it("connects onEnter handler", async () => {
                const handleEnter = vi.fn();

                await render(
                    <GtkButton label="Hover Me" controllers={<GtkEventControllerMotion onEnter={handleEnter} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);
                expect(handleEnter).toHaveBeenCalledTimes(1);
            });

            it("connects onLeave handler", async () => {
                const handleLeave = vi.fn();

                await render(
                    <GtkButton label="Hover Me" controllers={<GtkEventControllerMotion onLeave={handleLeave} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);
                await userEvent.unhover(button);
                expect(handleLeave).toHaveBeenCalledTimes(1);
            });
        });
    });
});

describe("widget - signals (7)", () => {
    describe("event controllers (2)", () => {
        describe("motion controller (2)", () => {
            it("disconnects motion handlers when controller removed", async () => {
                const handleEnter = vi.fn();

                function App({ hasController }: { hasController: boolean }) {
                    return (
                        <GtkButton
                            label="Hover"
                            controllers={hasController && <GtkEventControllerMotion onEnter={handleEnter} />}
                        />
                    );
                }

                const { rerender } = await render(<App hasController={true} />);
                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover" });
                await userEvent.hover(button);
                expect(handleEnter).toHaveBeenCalledTimes(1);
                await rerender(<App hasController={false} />);
                await userEvent.unhover(button);
                await userEvent.hover(button);
                expect(handleEnter).toHaveBeenCalledTimes(1);
            });
        });
    });
});

describe("widget - signals (8)", () => {
    describe("event controllers (3)", () => {
        describe("click controller", () => {
            it("connects onPressed handler", async () => {
                const handlePressed = vi.fn();

                await render(
                    <GtkButton label="Press Me" controllers={<GtkGestureClick onPressed={handlePressed} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press Me" });
                await userEvent.pointer(button, "down");
                expect(handlePressed).toHaveBeenCalledTimes(1);
            });

            it("connects onReleased handler", async () => {
                const handleReleased = vi.fn();

                await render(
                    <GtkButton label="Release Me" controllers={<GtkGestureClick onReleased={handleReleased} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Release Me" });
                await userEvent.pointer(button, "click");
                expect(handleReleased).toHaveBeenCalledTimes(1);
            });

            it("passes coordinates to press handler", async () => {
                const handlePressed = vi.fn();
                await render(<GtkButton label="Press" controllers={<GtkGestureClick onPressed={handlePressed} />} />);
                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press" });
                await userEvent.pointer(button, "down");
                expect(handlePressed).toHaveBeenCalled();
                const [nPress, x, y] = handlePressed.mock.calls[0] as [number, number, number];
                expect(typeof nPress).toBe("number");
                expect(typeof x).toBe("number");
                expect(typeof y).toBe("number");
            });
        });
    });
});

describe("widget - signals (9)", () => {
    describe("event controllers (4)", () => {
        describe("key controller (1)", () => {
            it("connects onKeyPressed handler", async () => {
                const handleKeyPressed = vi.fn(() => Gdk.EVENT_PROPAGATE);

                await render(
                    <GtkButton
                        label="Focus me"
                        canFocus
                        focusable
                        controllers={<GtkEventControllerKey onKeyPressed={handleKeyPressed} />}
                    />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
                await userEvent.keyboard(button, "a");
                expect(handleKeyPressed).toHaveBeenCalled();
            });

            it("connects onKeyReleased handler", async () => {
                const handleKeyReleased = vi.fn();

                await render(
                    <GtkButton
                        label="Focus me"
                        canFocus
                        focusable
                        controllers={<GtkEventControllerKey onKeyReleased={handleKeyReleased} />}
                    />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
                await userEvent.keyboard(button, "a");
                expect(handleKeyReleased).toHaveBeenCalled();
            });
        });
    });
});

describe("widget - signals (10)", () => {
    describe("event controllers (5)", () => {
        describe("key controller (2)", () => {
            it("disconnects key handlers when controller removed", async () => {
                const handleKeyPressed = vi.fn(() => Gdk.EVENT_PROPAGATE);

                function App({ hasController }: { hasController: boolean }) {
                    return (
                        <GtkButton
                            label="Focus me"
                            canFocus
                            focusable
                            controllers={hasController && <GtkEventControllerKey onKeyPressed={handleKeyPressed} />}
                        />
                    );
                }

                const { rerender } = await render(<App hasController={true} />);
                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
                await userEvent.keyboard(button, "a");
                expect(handleKeyPressed).toHaveBeenCalledTimes(1);
                await rerender(<App hasController={false} />);
                await userEvent.keyboard(button, "b");
                expect(handleKeyPressed).toHaveBeenCalledTimes(1);
            });
        });
    });
});

describe("widget - signals (11)", () => {
    describe("onNotify", () => {
        it("connects onNotify handler for property changes", async () => {
            const handleNotify = vi.fn();
            await renderSwitchAndClick({ onNotify: handleNotify });

            await waitFor(() => {
                expect(handleNotify).toHaveBeenCalled();
            });
        });

        it("receives the changed ParamSpec and source widget in callback", async () => {
            const handleNotify = vi.fn();
            await renderSwitchAndClick({ onNotify: handleNotify });

            await waitFor(() => {
                expect(handleNotify).toHaveBeenCalledWith(expect.any(GObject.ParamSpec), expect.any(Gtk.Switch));
            });
        });
    });
});

describe("widget - child management > GtkBox", () => {
    it("creates Box widget", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} />);
        expect(ref.current).not.toBeNull();
    });

    it("appends children", async () => {
        await render(
            <GtkBox>
                <GtkLabel>First</GtkLabel>
                <GtkLabel>Second</GtkLabel>
            </GtkBox>,
        );

        expect(screen.getByText("First")).toBeDefined();
        expect(screen.getByText("Second")).toBeDefined();
    });

    it("removes children", async () => {
        const { rerender } = await render(<LabelList count={3} />);
        await rerender(<LabelList count={1} />);
        expect(screen.getAllByText(/Label/)).toHaveLength(1);
    });
});

describe("widget - auto-wrapping (1)", () => {
    describe("GtkListBox (1)", () => {
        it("creates ListBox widget", async () => {
            const ref = createRef<Gtk.ListBox>();
            await render(<GtkListBox ref={ref} />);
            expect(ref.current).not.toBeNull();
        });

        it("wraps children in ListBoxRow", async () => {
            const listBoxRef = createRef<Gtk.ListBox>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox ref={listBoxRef}>
                    <GtkLabel ref={labelRef}>Item 1</GtkLabel>
                </GtkListBox>,
            );

            expect(screen.getByText("Item 1")).toBeDefined();
            expect(labelRef.current?.getParent()).not.toBe(listBoxRef.current);
        });

        it("appends multiple children", async () => {
            const listBoxRef = createRef<Gtk.ListBox>();

            await render(
                <GtkListBox ref={listBoxRef}>
                    <GtkLabel>Item 1</GtkLabel>
                    <GtkLabel>Item 2</GtkLabel>
                    <GtkLabel>Item 3</GtkLabel>
                </GtkListBox>,
            );

            expect(labelCount(listBoxRef.current)).toBe(3);
        });
    });
});

describe("widget - auto-wrapping (2)", () => {
    describe("GtkListBox (2)", () => {
        it("removes children", async () => {
            const listBoxRef = createRef<Gtk.ListBox>();

            function App({ items }: { items: string[] }) {
                return <GtkListBox ref={listBoxRef}>{labelItems(items)}</GtkListBox>;
            }

            const { rerender } = await render(<App items={["a", "b", "c"]} />);
            expect(labelCount(listBoxRef.current)).toBe(3);
            await rerender(<App items={["a", "c"]} />);
            expect(labelCount(listBoxRef.current)).toBe(2);
        });

        it("reorders children", async () => {
            const { rerender } = await render(<LabelListBox items={["first", "second"]} />);
            await rerender(<LabelListBox items={["second", "first"]} />);
            expect(screen.getByText("first")).toBeDefined();
            expect(screen.getByText("second")).toBeDefined();
        });
    });
});

describe("widget - auto-wrapping (3)", () => {
    describe("GtkFlowBox (1)", () => {
        it("creates FlowBox widget", async () => {
            const ref = createRef<Gtk.FlowBox>();
            await render(<GtkFlowBox ref={ref} />);
            expect(ref.current).not.toBeNull();
        });

        it("wraps children in FlowBoxChild", async () => {
            const flowBoxRef = createRef<Gtk.FlowBox>();
            const labelRef = createRef<Gtk.Label>();

            await render(
                <GtkFlowBox ref={flowBoxRef}>
                    <GtkLabel ref={labelRef}>Item 1</GtkLabel>
                </GtkFlowBox>,
            );

            expect(screen.getByText("Item 1")).toBeDefined();
            expect(labelRef.current?.getParent()).not.toBe(flowBoxRef.current);
        });

        it("appends multiple children", async () => {
            const flowBoxRef = createRef<Gtk.FlowBox>();

            await render(
                <GtkFlowBox ref={flowBoxRef}>
                    <GtkLabel>Item 1</GtkLabel>
                    <GtkLabel>Item 2</GtkLabel>
                    <GtkLabel>Item 3</GtkLabel>
                </GtkFlowBox>,
            );

            expect(labelCount(flowBoxRef.current)).toBe(3);
        });
    });
});

describe("widget - auto-wrapping (4)", () => {
    describe("GtkFlowBox (2)", () => {
        it("removes children", async () => {
            const flowBoxRef = createRef<Gtk.FlowBox>();

            function App({ items }: { items: string[] }) {
                return <GtkFlowBox ref={flowBoxRef}>{labelItems(items)}</GtkFlowBox>;
            }

            const { rerender } = await render(<App items={["a", "b", "c"]} />);
            expect(labelCount(flowBoxRef.current)).toBe(3);
            await rerender(<App items={["a"]} />);
            expect(labelCount(flowBoxRef.current)).toBe(1);
        });
    });
});

describe("widget - AboutDialog (1)", () => {
    describe("creditSections", () => {
        it("applies credit sections on mount", async () => {
            const ref = createRef<Gtk.AboutDialog>();

            await renderInApp(
                <GtkApplicationWindow>
                    {createPortal(
                        <GtkAboutDialog
                            ref={ref}
                            programName="Test App"
                            creditSections={[
                                { sectionName: "Contributors", people: ["Alice", "Bob"] },
                                { sectionName: "Testers", people: ["Charlie"] },
                            ]}
                        />,
                        rootElement,
                    )}
                </GtkApplicationWindow>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("applies empty credit sections array", async () => {
            const ref = createRef<Gtk.AboutDialog>();

            await renderInApp(
                <GtkApplicationWindow>
                    {createPortal(<GtkAboutDialog ref={ref} programName="Test App" creditSections={[]} />, rootElement)}
                </GtkApplicationWindow>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("renders without creditSections prop", async () => {
            const ref = createRef<Gtk.AboutDialog>();

            await renderInApp(
                <GtkApplicationWindow>
                    {createPortal(<GtkAboutDialog ref={ref} programName="Test App" />, rootElement)}
                </GtkApplicationWindow>,
            );

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("widget - AboutDialog (2)", () => {
    describe("lifecycle", () => {
        it("presents dialog on mount", async () => {
            await renderInApp(
                <GtkApplicationWindow>
                    {createPortal(<GtkAboutDialog programName="Lifecycle Test" />, rootElement)}
                </GtkApplicationWindow>,
            );

            expect(await screen.findByText(/Lifecycle Test/)).toBeDefined();
        });

        it("destroys dialog on unmount", async () => {
            const ref = createRef<Gtk.AboutDialog>();
            const appId = uniqueAppId();

            function App({ show }: { show: boolean }) {
                return (
                    <GtkApplication applicationId={appId} flags={Gio.ApplicationFlags.NON_UNIQUE}>
                        <GtkApplicationWindow>
                            {show
                                ? createPortal(<GtkAboutDialog ref={ref} programName="Unmount Test" />, rootElement)
                                : null}
                        </GtkApplicationWindow>
                    </GtkApplication>
                );
            }

            const { rerender } = await baseRender(<App show={true} />, { container: rootElement });
            const handle = ref.current;
            expect(handle).toBeDefined();
            await rerender(<App show={false} />);
        });
    });
});
