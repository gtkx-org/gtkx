import type { ComponentProps, ReactElement, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkExpander,
    GtkFlowBox,
    GtkFlowBoxChild,
    GtkGestureClick,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkNotebook,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { queryAllControllers, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderRowBox } from "../helpers/row-box.js";
import { getSelection } from "../helpers/selection-state.js";

type DecoratedButton = {
    boxRef: RefObject<Gtk.Box | null>;
    onPressed: ReturnType<typeof vi.fn>;
    onClicked: ReturnType<typeof vi.fn>;
};

type PressHandler = (nPress: number, x: number, y: number, self: Gtk.GestureClick) => void;

type GesturedListBox = {
    listBox: Gtk.ListBox;
    onPressed: ReturnType<typeof vi.fn>;
    onRowActivated: ReturnType<typeof vi.fn>;
};

type FlowBoxProps = Partial<ComponentProps<typeof GtkFlowBox>>;
type ActivatableChildren = { refs: RefObject<Gtk.FlowBoxChild | null>[]; onChildActivated: ReturnType<typeof vi.fn> };
type SelectedPair = { refs: RefObject<Gtk.FlowBoxChild | null>[]; flowBox: Gtk.FlowBox };

const renderDecoratedButton = async (): Promise<DecoratedButton> => {
    const boxRef = createRef<Gtk.Box>();
    const onPressed = vi.fn();
    const onClicked = vi.fn();

    await render(
        <GtkButton onClicked={onClicked}>
            <GtkBox ref={boxRef} controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkLabel label="decorated" />
            </GtkBox>
        </GtkButton>,
    );

    return { boxRef, onPressed, onClicked };
};

const expectClickInsideButton = async (
    child: (onPressed: PressHandler) => ReactElement,
    text: string,
    expected: { presses: number; clicks: number },
): Promise<void> => {
    const onPressed = vi.fn();
    const onClicked = vi.fn();
    await render(<GtkButton onClicked={onClicked}>{child(onPressed)}</GtkButton>);
    await userEvent.click(screen.getByText(text));
    expect(onPressed).toHaveBeenCalledTimes(expected.presses);
    expect(onClicked).toHaveBeenCalledTimes(expected.clicks);
};

const clickRecorder = (order: string[], name: string): ReactElement => (
    <GtkGestureClick
        onPressed={() => {
            order.push(`${name}:pressed`);
        }}
        onReleased={() => {
            order.push(`${name}:released`);
        }}
    />
);

const renderNestedGestures = async (order: string[]): Promise<Gtk.Box> => {
    const innerRef = createRef<Gtk.Box>();

    await render(
        <GtkBox controllers={clickRecorder(order, "outer")}>
            <GtkBox ref={innerRef} controllers={clickRecorder(order, "inner")}>
                <GtkLabel label="nested" />
            </GtkBox>
        </GtkBox>,
    );

    return innerRef.current as Gtk.Box;
};

const renderGesturedListBox = async (): Promise<GesturedListBox> => {
    const ref = createRef<Gtk.ListBox>();
    const onPressed = vi.fn();
    const onRowActivated = vi.fn();

    await render(
        <GtkListBox
            ref={ref}
            onRowActivated={onRowActivated}
            controllers={<GtkGestureClick onPressed={onPressed} />}
        />,
    );

    return { listBox: ref.current as Gtk.ListBox, onPressed, onRowActivated };
};

const appendLabeledRows = (listBox: Gtk.ListBox, count: number): Gtk.ListBoxRow[] =>
    Array.from({ length: count }, (_, index) => {
        const row = new Gtk.ListBoxRow();
        row.setChild(new Gtk.Label({ label: `Detachable ${String(index)}` }));
        listBox.append(row);

        return row;
    });

const detachOnPress = (listBox: Gtk.ListBox, row: Gtk.ListBoxRow): void => {
    const gesture = new Gtk.GestureClick();
    row.addController(gesture);

    gesture.on("pressed", () => {
        listBox.remove(row);
    });
};

const expectSelectWithoutActivation = async (
    pickTarget: (refs: RefObject<Gtk.ListBoxRow | null>[]) => Gtk.Widget,
): Promise<void> => {
    const onRowActivated = vi.fn();

    const refs = await renderRowBox(
        { selectionMode: Gtk.SelectionMode.SINGLE, activateOnSingleClick: false, onRowActivated },
        2,
    );

    await userEvent.click(pickTarget(refs));
    expect(onRowActivated).not.toHaveBeenCalled();
    expect(getSelection(refs)).toEqual([false, true]);
};

const renderChildren = async (props: FlowBoxProps): Promise<RefObject<Gtk.FlowBoxChild | null>[]> => {
    const refs = [createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>(), createRef<Gtk.FlowBoxChild>()];

    await render(
        <GtkFlowBox {...props}>
            {refs.map((ref, index) => (
                <GtkFlowBoxChild key={index} ref={ref}>
                    <GtkLabel label={`Child ${String(index)}`} />
                </GtkFlowBoxChild>
            ))}
        </GtkFlowBox>,
    );

    return refs;
};

const renderSelectedPair = async (): Promise<SelectedPair> => {
    const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.MULTIPLE });
    const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
    await userEvent.selectOptions(flowBox, [0, 2]);

    return { refs, flowBox };
};

const renderActivatableChildren = async (props: FlowBoxProps): Promise<ActivatableChildren> => {
    const onChildActivated = vi.fn();
    const refs = await renderChildren({ ...props, onChildActivated });

    return { refs, onChildActivated };
};

describe("userEvent click - row descendants", () => {
    it("activates the row owning the clicked label, not the row under the container center", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.SINGLE }, 5);
        await userEvent.click(screen.getByText("Row 3"));
        expect(getSelection(refs)).toEqual([false, false, false, true, false]);
        await userEvent.click(screen.getByText("Row 0"));
        expect(getSelection(refs)).toEqual([true, false, false, false, false]);
    });

    it("resolves when a row gesture handler hides the clicked row", async () => {
        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.NONE, activateOnSingleClick: false },
            2,
            (index) =>
                index === 1
                    ? { controllers: <GtkGestureClick onPressed={() => refs[1]?.current?.setVisible(false)} /> }
                    : {},
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(refs[1]?.current?.getVisible()).toBe(false);
    });
});

describe("userEvent click - gesture-driven widgets", () => {
    it("fires an ancestor's gesture instead of the gesture GTK gave the clicked widget", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const onPressed = vi.fn();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkNotebook ref={notebookRef} />
            </GtkBox>,
        );

        await userEvent.click(notebookRef.current as Gtk.Notebook);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("fires a click gesture the row carries when its label is clicked", async () => {
        const onPressed = vi.fn();
        const onRowActivated = vi.fn();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE} onRowActivated={onRowActivated}>
                    <GtkListBoxRow controllers={<GtkGestureClick onPressed={onPressed} />}>
                        <GtkLabel label="Gestured row" />
                    </GtkListBoxRow>
                </GtkListBox>
            </GtkBox>,
        );

        await userEvent.click(screen.getByText("Gestured row"));
        expect(onPressed).toHaveBeenCalled();
        expect(onRowActivated).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent click - gesture provenance", () => {
    it("fires a gesture wired with connect() instead of a signal prop", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();
        await render(<GtkBox ref={boxRef} />);
        const box = boxRef.current as Gtk.Box;
        const gesture = new Gtk.GestureClick();
        box.addController(gesture);
        gesture.connect("pressed", onPressed);
        await userEvent.click(box);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("does not let a gesture without click handlers consume the click", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onClicked = vi.fn();
        const onCancel = vi.fn();

        await render(
            <GtkButton onClicked={onClicked}>
                <GtkBox ref={boxRef} controllers={<GtkGestureClick onCancel={onCancel} />}>
                    <GtkLabel label="inner target" />
                </GtkBox>
            </GtkButton>,
        );

        await userEvent.click(boxRef.current as Gtk.Box);
        expect(onClicked).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("leaves a secondary-button gesture out of a primary click", async () => {
        await expectClickInsideButton(
            (onPressed) => (
                <GtkBox controllers={<GtkGestureClick button={3} onPressed={onPressed} />}>
                    <GtkLabel label="secondary" />
                </GtkBox>
            ),
            "secondary",
            { presses: 0, clicks: 1 },
        );
    });
});

describe("userEvent click - widgets carrying only GTK's own gestures", () => {
    it("clicks a text view without driving the gesture GTK gave it", async () => {
        const ref = createRef<Gtk.TextView>();
        await render(<GtkTextView ref={ref} />);
        await userEvent.click(ref.current as Gtk.TextView);
        expect(ref.current).toHaveFocus();
    });

    it("drives only the gesture a text view was given, not the ones GTK gave it", async () => {
        const ref = createRef<Gtk.TextView>();
        const onPressed = vi.fn();
        await render(<GtkTextView ref={ref} controllers={<GtkGestureClick onPressed={onPressed} />} />);
        await userEvent.click(ref.current as Gtk.TextView);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("expands an expander when its title label is clicked", async () => {
        const ref = createRef<Gtk.Expander>();

        await render(
            <GtkExpander ref={ref} label="More details">
                <GtkLabel label="Body" />
            </GtkExpander>,
        );

        await userEvent.click(screen.getByText("More details"));
        expect(ref.current?.getExpanded()).toBe(true);
    });

    it("expands an expander nested in a row instead of activating the row", async () => {
        const ref = createRef<Gtk.Expander>();
        const onRowActivated = vi.fn();

        await render(
            <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE} onRowActivated={onRowActivated}>
                <GtkListBoxRow>
                    <GtkExpander ref={ref} label="More details">
                        <GtkLabel label="Body" />
                    </GtkExpander>
                </GtkListBoxRow>
            </GtkListBox>,
        );

        await userEvent.click(screen.getByText("More details"));
        expect(ref.current?.getExpanded()).toBe(true);
        expect(onRowActivated).not.toHaveBeenCalled();
    });
});

describe("userEvent click - widgets carrying a gesture of their own", () => {
    it("fires a gesture a label carries instead of passing the click outwards alone", async () => {
        await expectClickInsideButton(
            (onPressed) => <GtkLabel label="tap me" controllers={<GtkGestureClick onPressed={onPressed} />} />,
            "tap me",
            { presses: 1, clicks: 1 },
        );
    });

    it("fires the gesture an activatable widget carries instead of activating it", async () => {
        const ref = createRef<Gtk.ListBox>();
        const onPressed = vi.fn();

        await render(
            <GtkListBox ref={ref} controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkListBoxRow>
                    <GtkLabel label="Only row" />
                </GtkListBoxRow>
            </GtkListBox>,
        );

        await userEvent.click(ref.current as Gtk.ListBox);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("hands the press to every gesture before releasing any of them", async () => {
        const order: string[] = [];
        const inner = await renderNestedGestures(order);
        await userEvent.click(inner);
        expect(order).toEqual(["inner:pressed", "outer:pressed", "inner:released", "outer:released"]);
    });
});

describe("userEvent click - gestures inside a button", () => {
    it("fires the clicked widget's gesture and the button around it", async () => {
        const { boxRef, onPressed, onClicked } = await renderDecoratedButton();
        await userEvent.click(boxRef.current as Gtk.Box);
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("reaches both from a label inside the gesture-carrying widget", async () => {
        const { onPressed, onClicked } = await renderDecoratedButton();
        await userEvent.click(screen.getByText("decorated"));
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("stops handing the press on once a gesture is disconnected", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();
        const onClicked = vi.fn();

        await render(
            <GtkButton onClicked={onClicked}>
                <GtkBox ref={boxRef} />
            </GtkButton>,
        );

        const box = boxRef.current as Gtk.Box;
        const gesture = new Gtk.GestureClick();
        box.addController(gesture);
        gesture.on("pressed", onPressed);
        gesture.off("pressed", onPressed);
        await userEvent.click(box);
        expect(onPressed).not.toHaveBeenCalled();
        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent dblClick - widgets outside a row", () => {
    it("presses the button around the clicked widget twice", async () => {
        const { onPressed, onClicked } = await renderDecoratedButton();
        await userEvent.dblClick(screen.getByText("decorated"));
        expect(onPressed).toHaveBeenCalledTimes(2);
        expect(onClicked).toHaveBeenCalledTimes(2);
    });
});

describe("userEvent dblClick - widgets inside a row", () => {
    it("presses the button a row wraps instead of the row", async () => {
        const onClicked = vi.fn();
        const onRowActivated = vi.fn();

        await render(
            <GtkListBox onRowActivated={onRowActivated}>
                <GtkListBoxRow>
                    <GtkButton label="Press" onClicked={onClicked} />
                </GtkListBoxRow>
            </GtkListBox>,
        );

        await userEvent.dblClick(screen.getByRole(Gtk.AccessibleRole.BUTTON));
        expect(onClicked).toHaveBeenCalledTimes(2);
        expect(onRowActivated).not.toHaveBeenCalled();
    });
});

describe("userEvent click - rows detached mid-click", () => {
    it("still reaches the container and skips the outcome of a detached row", async () => {
        const { listBox, onPressed, onRowActivated } = await renderGesturedListBox();
        const row = new Gtk.ListBoxRow();
        listBox.append(row);
        detachOnPress(listBox, row);
        await userEvent.click(row);
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onRowActivated).not.toHaveBeenCalled();
        expect(row.getParent()).toBeNull();
    });

    it("delivers the container gesture at the position the detached row held", async () => {
        const { listBox, onPressed } = await renderGesturedListBox();
        const first = appendLabeledRows(listBox, 4)[0] as Gtk.ListBoxRow;
        detachOnPress(listBox, first);

        await waitFor(() => {
            expect(first.getHeight()).toBeGreaterThan(0);
        });

        const [, bounds] = first.computeBounds(listBox);
        await userEvent.click(first);
        const pressY = (onPressed.mock.calls[0] as [number, number, number])[2];
        expect(pressY).toBeGreaterThanOrEqual(bounds.getY());
        expect(pressY).toBeLessThanOrEqual(bounds.getY() + bounds.getHeight());
    });
});

describe("userEvent click - container gestures", () => {
    it("fires a click gesture the list box carries when one of its row descendants is clicked", async () => {
        const onPressed = vi.fn();
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            {
                selectionMode: Gtk.SelectionMode.SINGLE,
                onRowActivated,
                controllers: <GtkGestureClick onPressed={onPressed} />,
            },
            2,
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("fires the widget's own click gesture when nothing else handles the click", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();
        await render(<GtkBox ref={boxRef} controllers={<GtkGestureClick onPressed={onPressed} />} />);
        await userEvent.click(boxRef.current as Gtk.Box);
        expect(onPressed).toHaveBeenCalledTimes(1);
    });

    it("delivers the container gesture at the clicked row's position, not the container center", async () => {
        const onPressed = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.SINGLE, controllers: <GtkGestureClick onPressed={onPressed} /> },
            5,
        );

        await userEvent.click(screen.getByText("Row 0"));
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        const pressY = (onPressed.mock.calls[0] as [number, number, number])[2];
        expect(listBox.getRowAtY(Math.round(pressY))).toBe(refs[0]?.current);
    });
});

describe("userEvent click - controller hygiene (1)", () => {
    it("leaves no gesture behind on a gesture-less widget and still reaches the button", async () => {
        const boxRef = createRef<Gtk.Box>();
        const onClicked = vi.fn();

        await render(
            <GtkButton onClicked={onClicked}>
                <GtkBox ref={boxRef} orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="inner" />
                </GtkBox>
            </GtkButton>,
        );

        const box = boxRef.current as Gtk.Box;
        await userEvent.dblClick(box);
        expect(onClicked).toHaveBeenCalledTimes(2);
        expect(queryAllControllers(box, Gtk.GestureClick)).toHaveLength(0);
        await userEvent.click(box);
        expect(onClicked).toHaveBeenCalledTimes(3);
    });

    it("leaves no gesture behind on a widget a pointer click touched", async () => {
        const innerRef = createRef<Gtk.Box>();
        const onPressed = vi.fn();

        await render(
            <GtkBox controllers={<GtkGestureClick onPressed={onPressed} />}>
                <GtkBox ref={innerRef} orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="pointer box" />
                </GtkBox>
            </GtkBox>,
        );

        const inner = innerRef.current as Gtk.Box;
        await userEvent.pointer(inner, "click");
        expect(queryAllControllers(inner, Gtk.GestureClick)).toHaveLength(0);
        await userEvent.click(screen.getByText("pointer box"));
        expect(onPressed).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent click - controller hygiene (2)", () => {
    it("leaves no gesture behind on the rows it clicks", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.SINGLE }, 3);
        await userEvent.click(screen.getByText("Row 0"));
        await userEvent.click(refs[1]?.current as Gtk.ListBoxRow);
        await userEvent.click(screen.getByText("Row 1"));

        expect(refs.map((ref) => queryAllControllers(ref.current as Gtk.ListBoxRow, Gtk.GestureClick))).toEqual([
            [],
            [],
            [],
        ]);
    });
});

describe("userEvent pointer - the button held across calls", () => {
    it("keeps a press over a gesture-less widget from swallowing the next one", async () => {
        const boxRef = createRef<Gtk.Box>();
        const buttonRef = createRef<Gtk.Button>();
        const onPressed = vi.fn();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkBox ref={boxRef}>
                    <GtkLabel label="empty" />
                </GtkBox>
                <GtkButton ref={buttonRef} label="Press" controllers={<GtkGestureClick onPressed={onPressed} />} />
            </GtkBox>,
        );

        const user = userEvent.setup();
        await user.pointer(boxRef.current as Gtk.Box, "down");
        await user.pointer(buttonRef.current as Gtk.Button, "down");
        expect(onPressed).toHaveBeenCalledTimes(1);
    });
});

describe("userEvent click - repeat and non-activating containers", () => {
    it("selects without activating when the list box does not activate on a single click", async () => {
        await expectSelectWithoutActivation(() => screen.getByText("Row 1"));
    });

    it("selects without activating when the row widget itself is clicked", async () => {
        await expectSelectWithoutActivation((refs) => refs[1]?.current as Gtk.ListBoxRow);
    });

    it("activates the row on a double click when a single click does not activate", async () => {
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.SINGLE, activateOnSingleClick: false, onRowActivated },
            2,
        );

        await userEvent.dblClick(refs[1]?.current as Gtk.ListBoxRow);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("activates the row on a double click when a single click already activates", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.SINGLE, onRowActivated }, 2);
        await userEvent.dblClick(refs[1]?.current as Gtk.ListBoxRow);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("activates the row owning a double-clicked label when a single click does not activate", async () => {
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.SINGLE, activateOnSingleClick: false, onRowActivated },
            2,
        );

        await userEvent.dblClick(screen.getByText("Row 1"));
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true]);
    });
});

describe("userEvent click - multiple-selection list boxes", () => {
    it("replaces the selection across clicks when a single click does not activate", async () => {
        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            2,
        );

        await userEvent.click(screen.getByText("Row 0"));
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([false, true]);
    });

    it("accumulates the selection when a single click also activates, as GTK does", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE }, 2);
        await userEvent.click(screen.getByText("Row 0"));
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([true, true]);
    });

    it("keeps the selection when the clicked row is not selectable", async () => {
        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            2,
            (index) => (index === 1 ? { selectable: false } : {}),
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.click(screen.getByText("Row 1"));
        expect(getSelection(refs)).toEqual([true, false]);
    });
});

describe("userEvent click - selection notifications", () => {
    it("never reports an empty selection while replacing it", async () => {
        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.MULTIPLE, activateOnSingleClick: false },
            3,
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        const reported: boolean[][] = [];

        listBox.on("selected-rows-changed", () => {
            reported.push(getSelection(refs));
        });

        await userEvent.click(screen.getByText("Row 1"));

        expect(reported).toEqual([
            [true, true, false],
            [false, true, false],
        ]);

        reported.length = 0;
        await userEvent.click(screen.getByText("Row 2"));

        expect(reported).toEqual([
            [false, true, true],
            [false, false, true],
        ]);
    });
});

describe("userEvent click - selection mode NONE", () => {
    it("activates without selecting when a single click activates", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.NONE, onRowActivated }, 2);
        await userEvent.click(screen.getByText("Row 1"));
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("neither activates nor selects when a single click does not activate", async () => {
        const onRowActivated = vi.fn();

        const refs = await renderRowBox(
            { selectionMode: Gtk.SelectionMode.NONE, activateOnSingleClick: false, onRowActivated },
            2,
        );

        await userEvent.click(screen.getByText("Row 1"));
        expect(onRowActivated).not.toHaveBeenCalled();
        expect(getSelection(refs)).toEqual([false, false]);
    });
});

describe("userEvent selection - FlowBox", () => {
    it("selects the child at a position", async () => {
        const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.SINGLE });
        const flowBox = refs[0]?.current?.getParent() as Gtk.FlowBox;
        await userEvent.selectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("selects several children when the mode allows it", async () => {
        const { refs } = await renderSelectedPair();
        expect(getSelection(refs)).toEqual([true, false, true]);
    });
});

describe("userEvent deselection - populated containers", () => {
    it("deselects a selected child and leaves an unselected one alone", async () => {
        const { refs, flowBox } = await renderSelectedPair();
        expect(getSelection(refs)).toEqual([true, false, true]);
        await userEvent.deselectOptions(flowBox, 2);
        expect(getSelection(refs)).toEqual([true, false, false]);
        await userEvent.deselectOptions(flowBox, 1);
        expect(getSelection(refs)).toEqual([true, false, false]);
    });

    it("deselects a row in browse selection mode", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.BROWSE }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([true, false]);
        await userEvent.deselectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("deselects the exact rows even when they cannot take focus", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE }, 2, (index) =>
            index === 1 ? { focusable: false } : {},
        );

        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, [0, 1]);
        expect(getSelection(refs)).toEqual([true, true]);
        await userEvent.deselectOptions(listBox, 0);
        expect(getSelection(refs)).toEqual([false, true]);
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)).toEqual([false, false]);
    });

    it("deselects a selected row that a filter keeps off screen", async () => {
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, [0, 1]);
        expect(getSelection(refs)).toEqual([true, true]);
        listBox.setFilterFunc((row) => row !== refs[1]?.current);
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)).toEqual([true, false]);
    });
});

describe("userEvent deselection - empty containers", () => {
    it("is a no-op on a list box with no rows", async () => {
        const ref = createRef<Gtk.ListBox>();
        await render(<GtkListBox ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} />);
        await userEvent.deselectOptions(ref.current as Gtk.ListBox, 0);
        expect(ref.current?.getSelectedRows()).toHaveLength(0);
    });

    it("is a no-op on a flow box with no children", async () => {
        const ref = createRef<Gtk.FlowBox>();
        await render(<GtkFlowBox ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} />);
        await userEvent.deselectOptions(ref.current as Gtk.FlowBox, 0);
        expect(ref.current?.getSelectedChildren()).toHaveLength(0);
    });
});

describe("userEvent click - flow box children (1)", () => {
    it("activates the child owning the clicked label when a single click activates", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
        });

        await userEvent.click(screen.getByText("Child 1"));
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("replaces the selection across clicks when a single click does not activate", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            activateOnSingleClick: false,
        });

        await userEvent.click(screen.getByText("Child 0"));
        expect(getSelection(refs)).toEqual([true, false, false]);
        await userEvent.click(screen.getByText("Child 2"));
        expect(onChildActivated).not.toHaveBeenCalled();
        expect(getSelection(refs)).toEqual([false, false, true]);
    });

    it("activates the child on a double click when a single click already activates", async () => {
        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
        });

        await userEvent.dblClick(refs[1]?.current as Gtk.FlowBoxChild);
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });

    it("fires a click gesture the flow box carries when one of its child descendants is clicked", async () => {
        const onPressed = vi.fn();

        const { refs, onChildActivated } = await renderActivatableChildren({
            selectionMode: Gtk.SelectionMode.SINGLE,
            controllers: <GtkGestureClick onPressed={onPressed} />,
        });

        await userEvent.click(screen.getByText("Child 1"));
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onChildActivated).toHaveBeenCalledTimes(1);
        expect(getSelection(refs)).toEqual([false, true, false]);
    });
});

describe("userEvent click - flow box children (2)", () => {
    it("leaves no gesture behind on the children it clicks", async () => {
        const refs = await renderChildren({ selectionMode: Gtk.SelectionMode.SINGLE });
        await userEvent.click(screen.getByText("Child 1"));
        await userEvent.dblClick(refs[2]?.current as Gtk.FlowBoxChild);

        expect(refs.map((ref) => queryAllControllers(ref.current as Gtk.FlowBoxChild, Gtk.GestureClick))).toEqual([
            [],
            [],
            [],
        ]);
    });
});

describe("userEvent selection - no activation side effects", () => {
    it("selects a list box row without activating it", async () => {
        const onRowActivated = vi.fn();
        const refs = await renderRowBox({ selectionMode: Gtk.SelectionMode.MULTIPLE, onRowActivated }, 2);
        const listBox = refs[0]?.current?.getParent() as Gtk.ListBox;
        await userEvent.selectOptions(listBox, 1);
        expect(getSelection(refs)[1]).toBe(true);
        expect(onRowActivated).not.toHaveBeenCalled();
        await userEvent.deselectOptions(listBox, 1);
        expect(getSelection(refs)[1]).toBe(false);
        expect(onRowActivated).not.toHaveBeenCalled();
    });
});
