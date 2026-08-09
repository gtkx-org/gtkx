import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkExpander,
    GtkGestureClick,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkNotebook,
    GtkTextView,
} from "@gtkx/jsx/gtk";
import { queryAllControllers, render, screen, userEvent } from "@gtkx/testing";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderRowBox } from "../helpers/row-box.js";
import { getSelection } from "../helpers/selection-state.js";

type DecoratedButton = {
    boxRef: RefObject<Gtk.Box | null>;
    onPressed: ReturnType<typeof vi.fn>;
    onClicked: ReturnType<typeof vi.fn>;
};

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
});

describe("userEvent click - widgets carrying only GTK's own gestures", () => {
    it("clicks a text view without driving the gesture GTK gave it", async () => {
        const ref = createRef<Gtk.TextView>();
        await render(<GtkTextView ref={ref} />);
        await expect(userEvent.click(ref.current as Gtk.TextView)).resolves.toBeUndefined();
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
        const ref = createRef<Gtk.ListBox>();
        const onRowActivated = vi.fn();
        const onPressed = vi.fn();

        await render(
            <GtkListBox
                ref={ref}
                onRowActivated={onRowActivated}
                controllers={<GtkGestureClick onPressed={onPressed} />}
            />,
        );

        const listBox = ref.current as Gtk.ListBox;
        const row = new Gtk.ListBoxRow();
        const gesture = new Gtk.GestureClick();
        listBox.append(row);
        row.addController(gesture);

        gesture.on("pressed", () => {
            listBox.remove(row);
        });

        await userEvent.click(row);
        expect(onPressed).toHaveBeenCalledTimes(1);
        expect(onRowActivated).not.toHaveBeenCalled();
        expect(row.getParent()).toBeNull();
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

describe("userEvent click - controller hygiene", () => {
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
        expect(queryAllControllers(box, Gtk.GestureClick)).toHaveLength(0);
        await userEvent.click(box);
        expect(onClicked).toHaveBeenCalledTimes(1);
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
