import type { ReactElement, RefObject } from "react";
import type { Mock } from "vitest";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwActionRow,
    AdwComboRow,
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwSpinRow,
    AdwSwitchRow,
    AdwToggle,
    AdwToggleGroup,
} from "@gtkx/jsx/adw";
import { GtkStringList } from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

type ListenerClearedCase<Widget> = {
    renderRow: (ref: RefObject<Widget | null>, handler: Mock | null) => ReactElement;
    afterMount?: (row: Widget) => void;
    fireFirst: (row: Widget) => void | Promise<void>;
    fireSecond: (row: Widget) => void | Promise<void>;
};

type Toggle = { id: string; label: string; isEnabled?: boolean };

const LIST_GRID_TOGGLES = (
    <>
        <AdwToggle name="list" label="List" />
        <AdwToggle name="grid" label="Grid" />
    </>
);

const LIST_GRID_VIEW_GROUP = (
    <AdwToggleGroup>
        <AdwToggle name="list" label="List View" iconName="view-list-symbolic" />
        <AdwToggle name="grid" label="Grid View" iconName="view-grid-symbolic" />
    </AdwToggleGroup>
);

const THREE_VIEW_GROUP = (
    <AdwToggleGroup>
        <AdwToggle name="list" label="List View" />
        <AdwToggle name="grid" label="Grid View" />
        <AdwToggle name="tiles" label="Tiles View" />
    </AdwToggleGroup>
);

const expectListenerClearedWhenHandlerNull = async <Widget,>({
    renderRow,
    afterMount,
    fireFirst,
    fireSecond,
}: ListenerClearedCase<Widget>) => {
    const handler = vi.fn();
    const ref = createRef<Widget>();
    const Harness = ({ active }: { active: Mock | null }) => renderRow(ref, active);
    const { rerender } = await render(<Harness active={handler} />);
    const row = ref.current;

    if (!row) {
        throw new Error("expected ref");
    }

    afterMount?.(row);
    handler.mockClear();
    await act(() => fireFirst(row));
    expect(handler).toHaveBeenCalledTimes(1);
    await rerender(<Harness active={null} />);
    await act(() => fireSecond(row));
    expect(handler).toHaveBeenCalledTimes(1);
};

function App({ shouldShowBehavior }: { shouldShowBehavior: boolean }) {
    return (
        <AdwPreferencesPage>
            <AdwPreferencesGroup title="Appearance">
                <AdwActionRow title="Dark Mode" />
            </AdwPreferencesGroup>
            {shouldShowBehavior && (
                <AdwPreferencesGroup title="Behavior">
                    <AdwActionRow title="Autosave" />
                </AdwPreferencesGroup>
            )}
        </AdwPreferencesPage>
    );
}

const installAdjustment = (row: Adw.SpinRow, lower: number, upper: number, value: number) => {
    const adjustment = Gtk.Adjustment.new(value, lower, upper, 1, 10, 0);
    row.setAdjustment(adjustment);

    return adjustment;
};

const getSwitch = (isChecked: boolean): Gtk.Widget =>
    screen.getByRole(Gtk.AccessibleRole.SWITCH, { checked: isChecked, as: Gtk.Switch });

const buildToggleGroup = (ref: RefObject<Adw.ToggleGroup | null>) => (toggles: Toggle[]) => (
    <AdwToggleGroup ref={ref}>
        {toggles.map((toggle) => (
            <AdwToggle key={toggle.id} name={toggle.id} label={toggle.label} enabled={toggle.isEnabled ?? true} />
        ))}
    </AdwToggleGroup>
);

const renderEnabledStateGroup = (ref: RefObject<Adw.ToggleGroup | null>) =>
    render(
        <AdwToggleGroup ref={ref}>
            <AdwToggle name="enabled" label="Enabled" />
            <AdwToggle name="disabled" label="Disabled" enabled={false} />
        </AdwToggleGroup>,
    );

const renderActiveNameGroup = (ref: RefObject<Adw.ToggleGroup | null>) =>
    render(
        <AdwToggleGroup ref={ref} activeName="done">
            <AdwToggle name="all" label="All" />
            <AdwToggle name="open" label="Open" />
            <AdwToggle name="done" label="Done" />
        </AdwToggleGroup>,
    );

const expectToggleActiveAfterClick = async (name: string): Promise<void> => {
    const toggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name });
    await userEvent.click(toggle);

    await waitFor(() => {
        expect(toggle).toBePressed();
    });
};

describe("render - PreferencesPage", () => {
    it("adds preference groups", async () => {
        await render(
            <AdwPreferencesPage>
                <AdwPreferencesGroup title="Appearance">
                    <AdwActionRow title="Dark Mode" />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Behavior">
                    <AdwActionRow title="Autosave" />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>,
        );

        expect(await screen.findByText("Appearance")).toAppearBefore(screen.getByText("Dark Mode"));
        expect(screen.getByText("Dark Mode")).toAppearBefore(screen.getByText("Autosave"));
    });

    it("removes a preference group when unmounted", async () => {
        const { rerender } = await render(<App shouldShowBehavior={true} />);
        expect(await screen.findByText("Autosave")).toBeRooted();
        await rerender(<App shouldShowBehavior={false} />);
        expect(screen.queryByText("Autosave")).toBeNull();
        expect(await screen.findByText("Dark Mode")).toBeRooted();
    });
});

describe("render - SpinRow (1)", () => {
    it("creates a SpinRow with a value", async () => {
        const adjustment = Gtk.Adjustment.new(5, 0, 100, 1, 10, 0);

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow title="Quantity" adjustment={adjustment} />
            </AdwPreferencesGroup>,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SPIN_BUTTON)).toHaveValue(5);
    });

    it("invokes onValueChanged when the value is updated programmatically", async () => {
        const onValueChanged = vi.fn();
        const ref = createRef<Adw.SpinRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSpinRow ref={ref} title="Q" value={1} onNotifyValue={onValueChanged} />
            </AdwPreferencesGroup>,
        );

        const row = ref.current;

        if (!row) {
            throw new Error("expected ref");
        }

        installAdjustment(row, 0, 10, 1);

        await act(() => {
            row.setValue(7);
        });

        expect(onValueChanged).toHaveBeenCalled();
        const lastCall = onValueChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(7);
    });
});

describe("render - SpinRow (2)", () => {
    it("removes the listener when onValueChanged is set to null", async () => {
        await expectListenerClearedWhenHandlerNull<Adw.SpinRow>({
            renderRow: (ref, handler) => (
                <AdwPreferencesGroup>
                    <AdwSpinRow ref={ref} title="Q" value={1} onNotifyValue={handler} />
                </AdwPreferencesGroup>
            ),
            afterMount: (row) => installAdjustment(row, 0, 10, 1),
            fireFirst: (row) => {
                row.setValue(2);
            },
            fireSecond: (row) => {
                row.setValue(5);
            },
        });
    });
});

describe("render - SwitchRow (1)", () => {
    it("creates a SwitchRow", async () => {
        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow title="Enabled" active={true} />
            </AdwPreferencesGroup>,
        );

        expect(getSwitch(true)).toBeChecked();
    });

    it("publishes the switch role and the checked state on the row and on its switch", async () => {
        const ref = createRef<Adw.SwitchRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow ref={ref} title="Enabled" active={true} />
            </AdwPreferencesGroup>,
        );

        const switches = screen.getAllByRole(Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(switches).toHaveLength(2);
        expect(switches).toContain(ref.current);
        expect(switches.filter((widget) => widget instanceof Gtk.Switch)).toHaveLength(1);
    });

    it("invokes onActiveChanged when toggled", async () => {
        const onActiveChanged = vi.fn();

        await render(
            <AdwPreferencesGroup>
                <AdwSwitchRow title="Enabled" active={false} onNotifyActive={onActiveChanged} />
            </AdwPreferencesGroup>,
        );

        await userEvent.click(getSwitch(false));
        expect(onActiveChanged).toHaveBeenCalled();
        const lastCall = onActiveChanged.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe(true);
    });
});

describe("render - SwitchRow (2)", () => {
    it("clears the listener when onActiveChanged becomes null", async () => {
        await expectListenerClearedWhenHandlerNull<Adw.SwitchRow>({
            renderRow: (ref, handler) => (
                <AdwPreferencesGroup>
                    <AdwSwitchRow ref={ref} title="Enabled" active={false} onNotifyActive={handler} />
                </AdwPreferencesGroup>
            ),
            fireFirst: () => userEvent.click(getSwitch(false)),
            fireSecond: () => userEvent.click(getSwitch(true)),
        });
    });
});

describe("userEvent selection - AdwComboRow", () => {
    it("selects an option on a row that is not a Gtk.DropDown", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(
            <AdwPreferencesGroup>
                <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["a", "b", "c"]} />} />
            </AdwPreferencesGroup>,
        );

        await userEvent.selectOptions(ref.current as Adw.ComboRow, 2);
        expect(ref.current).toHaveObjectProperty("selected", 2);
    });
});

describe("render - ToggleGroup (1)", () => {
    describe("AdwToggleGroup (1)", () => {
        it("creates ToggleGroup widget without toggles", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await render(<AdwToggleGroup ref={ref} />);
            expect(ref.current).not.toBeNull();
            expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(0);
        });

        it("creates ToggleGroup widget with toggles", async () => {
            await render(LIST_GRID_VIEW_GROUP);
            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(2);
        });

        it("sets toggle label", async () => {
            await render(
                <AdwToggleGroup>
                    <AdwToggle name="test" label="Test Label" />
                </AdwToggleGroup>,
            );

            const toggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Test Label" });
            expect(toggle).toHaveTextContent("Test Label");
        });

        it("sets toggle enabled state", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await renderEnabledStateGroup(ref);
            expect(ref.current?.getToggleByName("enabled")).toHaveObjectProperty("enabled", true);
            expect(ref.current?.getToggleByName("disabled")).toHaveObjectProperty("enabled", false);
        });

        it("selects the toggle named by activeName once its toggle exists", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            await renderActiveNameGroup(ref);
            expect(ref.current).toHaveObjectProperty("activeName", "done");
        });
    });
});

describe("render - ToggleGroup (2)", () => {
    describe("AdwToggleGroup (2)", () => {
        it("updates toggle props", async () => {
            const ref = createRef<Adw.ToggleGroup>();
            const { rerender } = await renderChildren([{ id: "test", label: "Initial" }], buildToggleGroup(ref));
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Initial" })).toBeRooted();
            await rerender([{ id: "test", label: "Updated" }]);
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Updated" })).toBeRooted();
            expect(screen.queryByRole(Gtk.AccessibleRole.RADIO, { name: "Initial" })).toBeNull();
        });

        it("removes toggles when list shrinks", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren(
                [
                    { id: "always", label: "Always" },
                    { id: "extra", label: "Extra" },
                ],
                buildToggleGroup(ref),
            );

            expect(await screen.findAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(2);

            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Always" })).toAppearBefore(
                screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Extra" }),
            );

            await rerender([{ id: "always", label: "Always" }]);

            await waitFor(() => {
                expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(1);
            });

            expect(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Always" })).toBeRooted();
            expect(screen.queryByRole(Gtk.AccessibleRole.RADIO, { name: "Extra" })).toBeNull();
        });
    });
});

describe("render - ToggleGroup (3)", () => {
    describe("AdwToggleGroup (3)", () => {
        it("handles inserting toggles dynamically", async () => {
            const ref = createRef<Adw.ToggleGroup>();

            const { rerender } = await renderChildren(
                [
                    { id: "first", label: "First" },
                    { id: "last", label: "Last" },
                ],
                buildToggleGroup(ref),
            );

            expect(await screen.findAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(2);

            await rerender([
                { id: "first", label: "First" },
                { id: "middle", label: "Middle" },
                { id: "last", label: "Last" },
            ]);

            await waitFor(() => {
                expect(screen.queryAllByRole(Gtk.AccessibleRole.RADIO)).toHaveLength(3);
            });

            const middle = screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Middle" });
            expect(middle).toAppearAfter(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "First" }));
            expect(middle).toAppearBefore(screen.getByRole(Gtk.AccessibleRole.RADIO, { name: "Last" }));
        });
    });
});

describe("render - ToggleGroup (4)", () => {
    describe("user interactions (1)", () => {
        it("clicks toggle to activate it", async () => {
            await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("List");
        });

        it("switches between toggles", async () => {
            await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("Grid");
        });
    });
});

describe("render - ToggleGroup (6)", () => {
    describe("uncontrolled selection", () => {
        it("preserves the clicked selection across an unrelated re-render", async () => {
            const { rerender } = await render(<AdwToggleGroup>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            await expectToggleActiveAfterClick("Grid");
            await rerender(<AdwToggleGroup cssClasses={["flat"]}>{LIST_GRID_TOGGLES}</AdwToggleGroup>);
            expect(await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "Grid" })).toBePressed();
        });
    });
});

describe("render - ToggleGroup (5)", () => {
    describe("user interactions (2)", () => {
        it("finds all toggles by role in a toggle group", async () => {
            await render(THREE_VIEW_GROUP);
            const toggles = await screen.findAllByRole(Gtk.AccessibleRole.RADIO);
            expect(toggles).toHaveLength(3);
            const listToggle = await screen.findByRole(Gtk.AccessibleRole.RADIO, { name: "List View" });
            expect(listToggle).toHaveTextContent("List View");
        });
    });
});
