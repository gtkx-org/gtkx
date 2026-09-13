import type * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { AdwLayout, AdwMultiLayoutView, AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { GtkButton, GtkLabel, GtkListBox, GtkListBoxRow, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

const GrowingPages = () => {
    const [hasTarget, setHasTarget] = useState(false);

    return (
        <>
            <GtkStackPage name="initial">
                <GtkButton
                    label="Add page"
                    onClicked={() => {
                        setHasTarget(true);
                    }}
                />
            </GtkStackPage>
            {hasTarget && <GtkStackPage name="target"><GtkLabel>Target</GtkLabel></GtkStackPage>}
        </>
    );
};

const GrowingRows = () => {
    const [hasTarget, setHasTarget] = useState(false);

    return (
        <>
            <GtkListBoxRow>
                <GtkButton
                    label="Add row"
                    onClicked={() => {
                        setHasTarget(true);
                    }}
                />
            </GtkListBoxRow>
            {hasTarget && <GtkListBoxRow><GtkLabel>Target</GtkLabel></GtkListBoxRow>}
        </>
    );
};

const GrowingLayouts = () => {
    const [hasTarget, setHasTarget] = useState(false);

    return (
        <>
            <AdwLayout name="initial">
                <GtkButton
                    label="Add layout"
                    onClicked={() => {
                        setHasTarget(true);
                    }}
                />
            </AdwLayout>
            {hasTarget && <AdwLayout name="target"><GtkLabel>Target</GtkLabel></AdwLayout>}
        </>
    );
};

describe("controlled parents whose child component updates independently", () => {
    it("selects a newly added stack page", async () => {
        const ref = createRef<Gtk.Stack>();
        await render(<GtkStack ref={ref} visibleChildName="target"><GrowingPages /></GtkStack>);
        await userEvent.click(screen.getByText("Add page"));
        expect(ref.current?.getVisibleChildName()).toBe("target");
    });

    it("selects a newly added list row", async () => {
        const ref = createRef<Gtk.ListBox>();
        await render(<GtkListBox ref={ref} selectedIndex={1}><GrowingRows /></GtkListBox>);
        await userEvent.click(screen.getByText("Add row"));
        expect(ref.current?.getSelectedRow()?.getIndex()).toBe(1);
    });

    it("switches between an indexed and a named toggle selection", async () => {
        const ref = createRef<Adw.ToggleGroup>();
        const ToggleGroup = ({ active }: { active?: number }) => (
            <AdwToggleGroup ref={ref} {...(active === undefined ? { activeName: "first" } : { active })}>
                <AdwToggle name="first" label="First" />
                <AdwToggle name="second" label="Second" />
            </AdwToggleGroup>
        );
        const { rerender } = await render(<ToggleGroup active={1} />);
        expect(ref.current?.getActiveName()).toBe("second");
        await rerender(<ToggleGroup />);
        expect(ref.current?.getActiveName()).toBe("first");
    });

    it("clears a named toggle selection with null", async () => {
        const ref = createRef<Adw.ToggleGroup>();
        const ToggleGroup = ({ activeName }: { activeName: string | null }) => (
            <AdwToggleGroup ref={ref} activeName={activeName}>
                <AdwToggle name="first" label="First" />
            </AdwToggleGroup>
        );
        const { rerender } = await render(<ToggleGroup activeName="first" />);
        expect(ref.current?.getActiveName()).toBe("first");
        await rerender(<ToggleGroup activeName={null} />);
        expect(ref.current?.getActiveName()).toBeNull();
    });

    it("selects a newly added layout", async () => {
        const ref = createRef<Adw.MultiLayoutView>();
        await render(<AdwMultiLayoutView ref={ref} layoutName="target" layouts={<GrowingLayouts />} />);
        await userEvent.click(screen.getByText("Add layout"));
        expect(ref.current?.getLayoutName()).toBe("target");
    });
});
