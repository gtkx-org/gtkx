import * as Adw from "@gtkx/gi/adw";
import * as GObject from "@gtkx/gi/gobject";
import {
    AdwBreakpoint,
    AdwBreakpointBin,
    AdwSidebar,
    AdwSidebarItem,
    AdwSidebarSection,
    AdwSpinner,
} from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { setProperty, t, typeFromName } from "@gtkx/runtime";
import { act, render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type ModeWrite = (sidebar: Adw.Sidebar, mode: Adw.SidebarMode) => void;
const modeValue = (mode: Adw.SidebarMode): GObject.Value => {
    const value = new GObject.Value();
    value.init(typeFromName("AdwSidebarMode"));
    value.setEnum(mode);

    return value;
};
const WRITES: { name: string; write: ModeWrite }[] = [
    { name: "method", write: (sidebar, mode) => {
        sidebar.setMode(mode);
    } },
    { name: "property", write: (sidebar, mode) => {
        sidebar.mode = mode;
    } },
    { name: "GObject.setProperty", write: (sidebar, mode) => {
        GObject.setProperty(sidebar, "mode", mode);
    } },
    { name: "descriptor property", write: (sidebar, mode) => {
        const descriptor = t.enum("libadwaita-1.so.0", "adw_sidebar_mode_get_type", false);
        setProperty(sidebar, "mode", descriptor, mode);
    } },
    { name: "GValue property", write: (sidebar, mode) => {
        sidebar.setProperty("mode", modeValue(mode));
    } },
];

const sidebarFixture = (mode: Adw.SidebarMode = Adw.SidebarMode.SIDEBAR) => {
    const sidebarRef = createRef<Adw.Sidebar>();
    const itemRef = createRef<Adw.SidebarItem>();
    const suffixRef = createRef<Adw.Spinner>();
    const Fixture = ({ hasSuffix = false }: { hasSuffix?: boolean }) => (
        <AdwSidebar ref={sidebarRef} mode={mode} placeholder={<GtkLabel>Empty</GtkLabel>}>
            <AdwSidebarSection title="Places">
                <AdwSidebarItem
                    ref={itemRef}
                    title="Files"
                    suffix={hasSuffix ? <AdwSpinner ref={suffixRef} /> : null}
                />
            </AdwSidebarSection>
        </AdwSidebar>
    );

    return { sidebarRef, itemRef, suffixRef, Fixture };
};

const expectSuffix = (item: Adw.SidebarItem | null, suffix: Adw.Spinner | null): void => {
    expect(item).toBeInstanceOf(Adw.SidebarItem);
    expect(suffix).toBeInstanceOf(Adw.Spinner);
    expect(suffix).toBeRooted();
    expect(item?.getSuffix()).toBe(suffix);
};

describe("Sidebar native mode compatibility", () => {
    it.each(WRITES)("keeps suffix updates usable after a $name mode write", async ({ write }) => {
        const { sidebarRef, itemRef, suffixRef, Fixture } = sidebarFixture();
        const { rerender, unmount } = await render(<Fixture />);
        const sidebar = sidebarRef.current;

        if (sidebar === null) {
            throw new Error("Sidebar did not mount");
        }

        expect(sidebar.getMode()).toBe(Adw.SidebarMode.SIDEBAR);
        await act(() => {
            write(sidebar, Adw.SidebarMode.PAGE);
        });
        expect(sidebar.getMode()).toBe(Adw.SidebarMode.PAGE);
        await rerender(<Fixture hasSuffix={true} />);
        expect(sidebarRef.current).toBe(sidebar);
        expectSuffix(itemRef.current, suffixRef.current);
        await act(() => {
            write(sidebar, Adw.SidebarMode.SIDEBAR);
        });
        expect(sidebar.getMode()).toBe(Adw.SidebarMode.SIDEBAR);
        await rerender(<Fixture />);
        expect(itemRef.current?.getSuffix()).toBeNull();
        await unmount();
        expect(sidebar.getItem(0)).toBeNull();
    });

    it.each(WRITES)("keeps mode transitions usable after a rejected $name write", async ({ write }) => {
        const { sidebarRef, itemRef, suffixRef, Fixture } = sidebarFixture();
        const { rerender } = await render(<Fixture />);
        const sidebar = sidebarRef.current;

        if (sidebar === null) {
            throw new Error("Sidebar did not mount");
        }

        expect(() => {
            Reflect.apply(write, undefined, [sidebar, "invalid"]);
        }).toThrow();
        expect(sidebar.getMode()).toBe(Adw.SidebarMode.SIDEBAR);
        await act(() => {
            write(sidebar, Adw.SidebarMode.PAGE);
        });
        expect(sidebar.getMode()).toBe(Adw.SidebarMode.PAGE);
        await rerender(<Fixture hasSuffix={true} />);
        expect(sidebarRef.current).toBe(sidebar);
        expectSuffix(itemRef.current, suffixRef.current);
    });

    it("starts in page mode with declared sections and suffixes", async () => {
        const { sidebarRef, itemRef, suffixRef, Fixture } = sidebarFixture(Adw.SidebarMode.PAGE);
        await render(<Fixture hasSuffix={true} />);
        expect(sidebarRef.current?.getMode()).toBe(Adw.SidebarMode.PAGE);
        expectSuffix(itemRef.current, suffixRef.current);
    });

    it("keeps suffix updates usable after a native breakpoint changes mode", async () => {
        const breakpointRef = createRef<Adw.Breakpoint>();
        const { sidebarRef, itemRef, suffixRef, Fixture } = sidebarFixture();
        const inactiveCondition = Adw.BreakpointCondition.parse("max-width: 1px");
        const Bin = ({ hasSuffix = false }: { hasSuffix?: boolean }) => (
            <AdwBreakpointBin
                widthRequest={400}
                heightRequest={200}
                breakpoints={(
                    <AdwBreakpoint ref={breakpointRef} condition={inactiveCondition} />
                )}
            >
                <Fixture hasSuffix={hasSuffix} />
            </AdwBreakpointBin>
        );
        const { rerender } = await render(<Bin />);
        const sidebar = sidebarRef.current;
        const breakpoint = breakpointRef.current;

        if (sidebar === null || breakpoint === null) {
            throw new Error("The breakpoint and sidebar did not mount");
        }

        expect(sidebar.getMode()).toBe(Adw.SidebarMode.SIDEBAR);
        breakpoint.addSetter(sidebar, "mode", modeValue(Adw.SidebarMode.PAGE));
        await act(() => {
            breakpoint.setCondition(Adw.BreakpointCondition.parse("max-width: 10000px"));
        });
        await waitFor(() => {
            expect(sidebar.getMode()).toBe(Adw.SidebarMode.PAGE);
        });
        await rerender(<Bin hasSuffix={true} />);
        expect(sidebar.getMode()).toBe(Adw.SidebarMode.PAGE);
        expect(sidebarRef.current).toBe(sidebar);
        expectSuffix(itemRef.current, suffixRef.current);
    });
});
