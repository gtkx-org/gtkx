import type { ComponentProps, ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { AdwPreferencesPage } from "@gtkx/jsx/adw";
import {
    GtkAboutDialog,
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
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "../helpers/application-render.js";
import { recordCalls, type RecordedCalls } from "../helpers/record-calls.js";

type LabelProps = ComponentProps<typeof GtkLabel>;
type PressArgs = Parameters<NonNullable<ComponentProps<typeof GtkGestureClick>["onPressed"]>>;

const renderInApp = createApplicationRenderer("org.gtkx.widgettest");

const readLabelPropAcrossReset = async <T,>(props: LabelProps, read: (label: Gtk.Label) => T): Promise<[T, T]> => {
    const ref = createRef<Gtk.Label>();

    const { rerender } = await render(
        <GtkLabel ref={ref} {...props}>
            x
        </GtkLabel>,
    );

    const mounted = ref.current;

    if (mounted === null) {
        throw new Error("expected the label to be mounted");
    }

    const before = read(mounted);
    await rerender(<GtkLabel ref={ref}>x</GtkLabel>);

    return [before, read(mounted)];
};

const labelCount = (container: Gtk.Widget | null): number => {
    if (container === null) {
        throw new Error("expected a mounted container");
    }

    return within(container).getAllByRole(Gtk.AccessibleRole.LABEL).length;
};

const findClickButton = () => screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click" });

const expectClickCallCount = async (button: Gtk.Widget, handler: RecordedCalls, times: number): Promise<void> => {
    await userEvent.click(button);

    await waitFor(() => {
        expect(handler.calls).toHaveLength(times);
    });
};

const renderClickButtonAndClick = async (): Promise<RecordedCalls<[Gtk.Button]>> => {
    const handleClick = recordCalls<[Gtk.Button]>();
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

const renderStateSetSwitchAndClick = async (): Promise<RecordedCalls<[boolean, Gtk.Switch]>> => {
    const calls = recordCalls<[boolean, Gtk.Switch]>();
    const shouldSetState = (isState: boolean, self: Gtk.Switch): boolean => {
        calls(isState, self);

        return Gdk.EVENT_PROPAGATE;
    };
    await renderSwitchAndClick({ onStateSet: shouldSetState });

    return calls;
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

function OptionalClickButton({ onClicked, isMounted }: { onClicked?: (() => void) | undefined; isMounted: boolean }) {
    return isMounted ? <GtkButton onClicked={onClicked} label="Click" /> : null;
}

const renderDialogInWindow = (dialog: ReactNode) =>
    renderInApp(<GtkApplicationWindow>{dialog}</GtkApplicationWindow>);

const renderAboutDialog = async (props: ComponentProps<typeof GtkAboutDialog>) => {
    const ref = createRef<Gtk.AboutDialog>();
    const result = await renderDialogInWindow(<GtkAboutDialog ref={ref} {...props} />);

    const dialog = ref.current;

    if (dialog === null) {
        throw new Error("Expected an AboutDialog instance");
    }

    return { dialog, ...result };
};

const renderKeyControllerAndType = async (controllers: ReactNode): Promise<void> => {
    await render(<GtkButton label="Focus me" canFocus focusable controllers={controllers} />);
    const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
    await userEvent.keyboard(button, "a");
};

function NamedBox({ boxRef, name }: { boxRef: RefObject<Gtk.Box | null>; name: string }) {
    return <GtkBox ref={boxRef} cssName={name} />;
}

function KeyedBox({ boxRef, name }: { boxRef: RefObject<Gtk.Box | null>; name: string }) {
    return <GtkBox key={name} ref={boxRef} cssName={name} />;
}

describe("widget - creation", () => {
    describe("basic widgets", () => {
        it("creates Label widget with text", async () => {
            await render(<GtkLabel>Hello World</GtkLabel>);
            const label = await screen.findByText("Hello World");
            expect(label).toBeRooted();
        });

        it("creates Button widget with label", async () => {
            await render(<GtkButton label="Click Me" />);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Click Me" });
            expect(button).toBeRooted();
            expect(button).toBeEnabled();
        });

        it("creates Box widget with orientation", async () => {
            const ref = createRef<Gtk.Box>();
            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);
            expect(ref.current).not.toBeNull();
            expect(ref.current).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        });

        it("creates Entry widget", async () => {
            await render(<GtkEntry placeholderText="Enter text" />);
            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(entry).toHaveAccessibleProperty(Gtk.AccessibleProperty.PLACEHOLDER, "Enter text");
        });

        it("creates Image widget", async () => {
            const ref = createRef<Gtk.Image>();
            await render(<GtkImage ref={ref} iconName="dialog-information" />);
            expect(ref.current).not.toBeNull();
            expect(ref.current).toHaveObjectProperty("iconName", "dialog-information");
        });
    });

    describe("constructor parameters", () => {
        it("passes constructor parameters from props", async () => {
            const ref = createRef<Gtk.Box>();
            await render(<GtkBox ref={ref} spacing={10} />);
            expect(ref.current).toHaveObjectProperty("spacing", 10);
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
            expect(ref.current).toBeRooted();
            expect(ref.current).toHaveTextContent("Widget Instance");
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
            expect(submitButton).toHaveTextContent("Submit");
            const cancelButton = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Cancel" });
            expect(cancelButton).toHaveTextContent("Cancel");
            expect(submitButton).toAppearBefore(cancelButton);
        });

        it("returns null for non-existent widget with queryBy", async () => {
            await render(<GtkButton label="Only Button" />);
            const nonExistent = screen.queryByRole(Gtk.AccessibleRole.TEXT_BOX);
            expect(nonExistent).toBeNull();
        });

        it("finds widgets by text content", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Welcome Message" />
                    <GtkButton label="Description Text" />
                </GtkBox>,
            );

            const welcome = await screen.findByText("Welcome Message");
            expect(welcome).toBeRooted();
            const allButtons = await screen.findAllByText(/Message|Text/);
            expect(allButtons).toHaveLength(2);
        });

        it("uses regex for partial text matching", async () => {
            await render(<GtkLabel>Error: Something went wrong</GtkLabel>);
            const errorLabel = await screen.findByText(/^Error:/);
            expect(errorLabel).toHaveTextContent("Error: Something went wrong");
        });
    });
});

describe("widget - props", () => {
    describe("property setting", () => {
        it("sets string properties", async () => {
            await render(<GtkLabel label="Test Label" />);
            const label = await screen.findByText("Test Label");
            expect(label).toBeRooted();
        });

        it("sets boolean properties", async () => {
            const ref = createRef<Gtk.Label>();
            await render(<GtkLabel ref={ref} selectable={true} />);
            expect(ref.current).toHaveObjectProperty("selectable", true);
        });

        it("sets numeric properties", async () => {
            const ref = createRef<Gtk.Label>();
            await render(<GtkLabel ref={ref} maxWidthChars={20} />);
            expect(ref.current).toHaveObjectProperty("maxWidthChars", 20);
        });

        it("sets enum properties", async () => {
            const ref = createRef<Gtk.Box>();
            await render(<GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />);
            expect(ref.current).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        });
    });

    describe("change detection", () => {
        it("preserves rendered text when the value is unchanged", async () => {
            const { rerender } = await render(<SameLabel />);
            const label = await screen.findByText("Same");
            expect(label).toBeRooted();
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
            expect(await screen.findByText("Now Set")).toHaveTextContent("Now Set");
        });

        it("preserves the last-set value when a prop transitions to undefined", async () => {
            const { rerender } = await render(<OptionalLabel label="Has Value" />);
            await screen.findByText("Has Value");
            await rerender(<OptionalLabel label={undefined} />);
            expect(screen.getByText("Has Value")).toHaveTextContent("Has Value");
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
            expect(switchWidget).toBeChecked();
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
            expect(checkedBox).toHaveAccessibleName("Checked");
            const uncheckedBox = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false });
            expect(uncheckedBox).toHaveAccessibleName("Unchecked");
            expect(uncheckedBox).not.toBeChecked();
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

describe("widget - signals", () => {
    describe("connection", () => {
        it("connects onClicked handler to clicked signal", async () => {
            const handleClick = await renderClickButtonAndClick();

            await waitFor(() => {
                expect(handleClick.calls).toHaveLength(1);
            });
        });

        it("connects onActivate handler to activate signal", async () => {
            const handleActivate = recordCalls();
            await render(<GtkEntry onActivate={handleActivate} placeholderText="Search" />);
            const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
            await userEvent.keyboard(entry, "{Enter}");
            expect(handleActivate.calls).toHaveLength(1);
        });

        it("connects onStateSet handler to state-set signal", async () => {
            const handleStateSet = await renderStateSetSwitchAndClick();

            await waitFor(() => {
                expect(handleStateSet.calls).toHaveLength(1);
            });
        });
    });

    describe("disconnection", () => {
        it("disconnects handler when prop removed", async () => {
            const handleClick = recordCalls();
            const { rerender } = await render(<ClickButton onClicked={handleClick} />);
            const button = await findClickButton();
            await expectClickCallCount(button, handleClick, 1);
            await rerender(<ClickButton />);
            await expectClickCallCount(button, handleClick, 1);
        });

        it("disconnects handler when widget unmounted", async () => {
            const handleClick = recordCalls();
            const { rerender } = await render(<OptionalClickButton isMounted={true} />);
            const button = await findClickButton();
            const clickedSignal = GObject.signalLookup("clicked", Gtk.Button);
            expect(GObject.signalHasHandlerPending(button, clickedSignal, 0, true)).toBe(false);
            await rerender(<OptionalClickButton onClicked={handleClick} isMounted={true} />);
            expect(await findClickButton()).toBe(button);
            expect(GObject.signalHasHandlerPending(button, clickedSignal, 0, true)).toBe(true);
            await expectClickCallCount(button, handleClick, 1);
            await rerender(<OptionalClickButton onClicked={handleClick} isMounted={false} />);
            expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON)).toBeNull();
            expect(button).not.toBeRooted();
            expect(GObject.signalHasHandlerPending(button, clickedSignal, 0, true)).toBe(false);
        });
    });

    describe("updates", () => {
        it("replaces handler when function reference changes", async () => {
            const handler1 = recordCalls();
            const handler2 = recordCalls();

            function App({ shouldUseHandler1 }: { shouldUseHandler1: boolean }) {
                return <GtkButton onClicked={shouldUseHandler1 ? handler1 : handler2} label="Click" />;
            }

            const { rerender } = await render(<App shouldUseHandler1={true} />);
            const button = await findClickButton();
            await expectClickCallCount(button, handler1, 1);
            expect(handler2.calls).toEqual([]);
            await rerender(<App shouldUseHandler1={false} />);
            await expectClickCallCount(button, handler2, 1);
            expect(handler1.calls).toHaveLength(1);
        });

        it("maintains handler when function reference is stable", async () => {
            const handleClick = recordCalls();

            function App({ label }: { label: string }) {
                return <GtkButton onClicked={handleClick} label={label} />;
            }

            const { rerender } = await render(<App label="First" />);
            await rerender(<App label="Second" />);
            const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Second" });
            await expectClickCallCount(button, handleClick, 1);
        });
    });

    describe("signal arguments", () => {
        it("receives signal arguments in callback", async () => {
            const handleStateSet = await renderStateSetSwitchAndClick();

            await waitFor(() => {
                expect(handleStateSet.calls).toContainEqual([true, expect.any(Gtk.Switch)]);
            });
        });

        it("invokes the parameterless handler with the source widget", async () => {
            const handleClick = await renderClickButtonAndClick();

            await waitFor(() => {
                expect(handleClick.calls).toContainEqual([expect.any(Gtk.Button)]);
            });
        });
    });

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
            expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Clicks: 3" })).toBeRooted();
        });
    });

    describe("event controllers", () => {
        describe("motion controller", () => {
            it("connects onEnter handler", async () => {
                const handleEnter = recordCalls();

                await render(
                    <GtkButton label="Hover Me" controllers={<GtkEventControllerMotion onEnter={handleEnter} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);
                expect(handleEnter.calls).toHaveLength(1);
            });

            it("connects onLeave handler", async () => {
                const handleLeave = recordCalls();

                await render(
                    <GtkButton label="Hover Me" controllers={<GtkEventControllerMotion onLeave={handleLeave} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hover Me" });
                await userEvent.hover(button);
                await userEvent.unhover(button);
                expect(handleLeave.calls).toHaveLength(1);
            });

            it("disconnects motion handlers when controller removed", async () => {
                const handleEnter = recordCalls();

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
                expect(handleEnter.calls).toHaveLength(1);
                await rerender(<App hasController={false} />);
                await userEvent.unhover(button);
                await userEvent.hover(button);
                expect(handleEnter.calls).toHaveLength(1);
            });
        });

        describe("click controller", () => {
            it("connects onPressed handler", async () => {
                const handlePressed = recordCalls();

                await render(
                    <GtkButton label="Press Me" controllers={<GtkGestureClick onPressed={handlePressed} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press Me" });
                await userEvent.pointer(button, "down");
                expect(handlePressed.calls).toHaveLength(1);
            });

            it("connects onReleased handler", async () => {
                const handleReleased = recordCalls();

                await render(
                    <GtkButton label="Release Me" controllers={<GtkGestureClick onReleased={handleReleased} />} />,
                );

                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Release Me" });
                await userEvent.pointer(button, "click");
                expect(handleReleased.calls).toHaveLength(1);
            });

            it("passes coordinates to press handler", async () => {
                const handlePressed = recordCalls<PressArgs>();
                await render(<GtkButton label="Press" controllers={<GtkGestureClick onPressed={handlePressed} />} />);
                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Press" });
                await userEvent.pointer(button, "down");
                expect(handlePressed.calls.length).toBeGreaterThan(0);
                expect(handlePressed.calls.every(([nPress]) => typeof nPress === "number")).toBe(true);
                expect(handlePressed.calls.every(([, x]) => typeof x === "number")).toBe(true);
                expect(handlePressed.calls.every((args) => typeof args[2] === "number")).toBe(true);
                expect(handlePressed.calls.every((args) => args[3] instanceof Gtk.GestureClick)).toBe(true);
            });
        });

        describe("key controller", () => {
            it("connects onKeyPressed handler", async () => {
                const keyPresses = recordCalls();
                await renderKeyControllerAndType(
                    <GtkEventControllerKey
                        onKeyPressed={() => {
                            keyPresses();

                            return Gdk.EVENT_PROPAGATE;
                        }}
                    />,
                );
                expect(keyPresses.calls.length).toBeGreaterThan(0);
            });

            it("connects onKeyReleased handler", async () => {
                const handleKeyReleased = recordCalls();
                await renderKeyControllerAndType(<GtkEventControllerKey onKeyReleased={handleKeyReleased} />);
                expect(handleKeyReleased.calls.length).toBeGreaterThan(0);
            });

            it("disconnects key handlers when controller removed", async () => {
                const keyPresses = recordCalls();
                const shouldPropagateKey = (): boolean => {
                    keyPresses();

                    return Gdk.EVENT_PROPAGATE;
                };

                function App({ hasController }: { hasController: boolean }) {
                    return (
                        <GtkButton
                            label="Focus me"
                            canFocus
                            focusable
                            controllers={hasController && <GtkEventControllerKey onKeyPressed={shouldPropagateKey} />}
                        />
                    );
                }

                const { rerender } = await render(<App hasController={true} />);
                const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
                await userEvent.keyboard(button, "a");
                expect(keyPresses.calls).toHaveLength(1);
                await rerender(<App hasController={false} />);
                await userEvent.keyboard(button, "b");
                expect(keyPresses.calls).toHaveLength(1);
            });
        });
    });

    describe("onNotify", () => {
        it("connects onNotify handler for property changes", async () => {
            const handleNotify = recordCalls();
            await renderSwitchAndClick({ onNotify: handleNotify });

            await waitFor(() => {
                expect(handleNotify.calls.length).toBeGreaterThan(0);
            });
        });

        it("receives the changed ParamSpec and source widget in callback", async () => {
            const handleNotify = recordCalls<[GObject.ParamSpec, Gtk.Switch]>();
            await renderSwitchAndClick({ onNotify: handleNotify });

            await waitFor(() => {
                expect(handleNotify.calls).toContainEqual([
                    expect.any(GObject.ParamSpec),
                    expect.any(Gtk.Switch),
                ]);
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

        expect(screen.getByText("First")).toAppearBefore(screen.getByText("Second"));
    });

    it("removes children", async () => {
        const { rerender } = await render(<LabelList count={3} />);
        await rerender(<LabelList count={1} />);
        expect(screen.getAllByText(/Label/)).toHaveLength(1);
    });
});

describe("widget - auto-wrapping", () => {
    describe("GtkListBox", () => {
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

            expect(screen.getByText("Item 1")).toBeRooted();
            expect(labelRef.current?.getParent()).toBeInstanceOf(Gtk.ListBoxRow);
            expect(listBoxRef.current).toContainElement(labelRef.current);
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
            expect(screen.getByText("second")).toAppearBefore(screen.getByText("first"));
        });
    });

    describe("GtkFlowBox", () => {
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

            expect(screen.getByText("Item 1")).toBeRooted();
            expect(labelRef.current?.getParent()).toBeInstanceOf(Gtk.FlowBoxChild);
            expect(flowBoxRef.current).toContainElement(labelRef.current);
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

describe("widget - AboutDialog", () => {
    describe("creditSections", () => {
        it("shows every credit section and person", async () => {
            const { dialog } = await renderAboutDialog({
                programName: "Test App",
                creditSections: [
                    { sectionName: "Contributors", people: ["Alice", "Bob"] },
                    { sectionName: "Testers", people: ["Charlie"] },
                ],
            });

            await userEvent.click(within(dialog).getByRole(Gtk.AccessibleRole.TAB, { name: "Credits" }));
            expect(within(dialog).getByText("Contributors", { exact: false })).toBeVisible();
            expect(within(dialog).getByText("Alice", { exact: false })).toBeVisible();
            expect(within(dialog).getByText("Bob", { exact: false })).toBeVisible();
            expect(within(dialog).getByText("Testers", { exact: false })).toBeVisible();
            expect(within(dialog).getByText("Charlie", { exact: false })).toBeVisible();
        });

        it.each([
            ["an empty credit sections array", []],
            ["no creditSections prop", undefined],
        ])("hides the Credits page with %s", async (_title, creditSections) => {
            const { dialog } = await renderAboutDialog({ programName: "Test App", creditSections });
            expect(within(dialog).getByText("Test App", { exact: false })).toBeVisible();
            expect(within(dialog).queryByRole(Gtk.AccessibleRole.TAB, { name: "Credits" })).toBeNull();
        });
    });

    describe("lifecycle", () => {
        it("presents dialog on mount", async () => {
            await renderDialogInWindow(<GtkAboutDialog programName="Lifecycle Test" />);
            expect(await screen.findByText(/Lifecycle Test/)).toBeRooted();
        });

        it("destroys dialog on unmount", async () => {
            const { rerender } = await renderAboutDialog({ programName: "Unmount Test" });
            expect(await screen.findByText(/Unmount Test/)).toBeRooted();
            await rerender(<GtkApplicationWindow />);
            expect(screen.queryByText(/Unmount Test/)).toBeNull();
        });
    });
});

describe("default-props reset on removal", () => {
    it("resets a boolean property to its GIR default when the prop is removed", async () => {
        const [before, after] = await readLabelPropAcrossReset({ selectable: true }, (label) => label.selectable);
        expect(before).toBe(true);
        expect(after).toBe(false);
    });

    it("resets an enum property to its GIR default", async () => {
        const [before, after] = await readLabelPropAcrossReset(
            { ellipsize: Pango.EllipsizeMode.END },
            (label) => label.ellipsize,
        );

        expect(before).toBe(Pango.EllipsizeMode.END);
        expect(after).toBe(Pango.EllipsizeMode.NONE);
    });

    it("resets a float property to its GIR default", async () => {
        const [before, after] = await readLabelPropAcrossReset({ xalign: 0.9 }, (label) => label.xalign);
        expect(before).toBeCloseTo(0.9);
        expect(after).toBeCloseTo(0.5);
    });

    it("replaces an icon with label text when the icon prop is removed", async () => {
        const ref = createRef<Gtk.Button>();
        const { rerender } = await render(<GtkButton ref={ref} iconName="list-add-symbolic" />);
        expect(ref.current).toHaveObjectProperty("iconName", "list-add-symbolic");

        await rerender(<GtkButton ref={ref} label="Cancel" />);
        expect(ref.current).toHaveTextContent("Cancel");
        expect(ref.current?.iconName).toBeNull();
    });

    it("resets a property with no typed C accessor through the static GValue path", async () => {
        const [before, after] = await readLabelPropAcrossReset({ widthRequest: 200 }, (label) => label.widthRequest);
        expect(before).toBe(200);
        expect(after).toBe(-1);
    });
});

describe("numeric props the property cannot hold as written", () => {
    it("truncates a fraction written to a whole-number property", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} marginStart={12.6} label="x" />);
        expect(ref.current).toHaveObjectProperty("marginStart", 12);
    });

    it("clamps a value outside the range the property allows", async () => {
        const ref = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={ref} opacity={1.5} marginTop={-4} label="x" />);
        expect(ref.current).toHaveObjectProperty("opacity", 1);
        expect(ref.current).toHaveObjectProperty("marginTop", 0);
        await rerender(<GtkLabel ref={ref} opacity={-0.5} marginTop={2.4} label="x" />);
        expect(ref.current).toHaveObjectProperty("opacity", 0);
        expect(ref.current).toHaveObjectProperty("marginTop", 2);
    });
});

describe("construct-only properties", () => {
    it("sets cssName during widget construction", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} cssName="my-custom-widget" />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("cssName", "my-custom-widget");
    });

    it("creates widget without construct-only prop set", async () => {
        const ref = createRef<Gtk.Box>();
        await render(<GtkBox ref={ref} />);
        expect(ref.current).not.toBeNull();
        expect(ref.current?.getCssName()).toBe("box");
    });

    it("constructs and sets a property a class redeclares from an ancestor", async () => {
        const ref = createRef<Adw.PreferencesPage>();
        await render(<AdwPreferencesPage ref={ref} name="general" title="General" />);
        expect(ref.current).not.toBeNull();
        expect(ref.current).toHaveObjectProperty("name", "general");
        expect(ref.current).toHaveObjectProperty("title", "General");
    });
});

describe("construct-only property changes", () => {
    it("throws when a construct-only prop changes on re-render", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<NamedBox boxRef={boxRef} name="initial-name" />);
        expect(boxRef.current).toHaveObjectProperty("cssName", "initial-name");

        await expect(rerender(<NamedBox boxRef={boxRef} name="changed-name" />)).rejects.toThrow();
    });

    it("applies the new value when the key changes with it", async () => {
        const boxRef = createRef<Gtk.Box>();
        const { rerender } = await render(<KeyedBox boxRef={boxRef} name="initial-name" />);
        const initial = boxRef.current;
        expect(initial).toHaveObjectProperty("cssName", "initial-name");
        await rerender(<KeyedBox boxRef={boxRef} name="changed-name" />);
        expect(boxRef.current).not.toBe(initial);
        expect(boxRef.current).toHaveObjectProperty("cssName", "changed-name");
    });
});
