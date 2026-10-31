import type { ReactNode, RefObject } from "react";
import type * as GObject from "@gtkx/gi/gobject";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBottomSheet,
    AdwLayout,
    AdwMultiLayoutView,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwOverlaySplitView,
    AdwTabOverview,
    AdwTabPage,
    AdwTabView,
    AdwToggle,
    AdwToggleGroup,
} from "@gtkx/jsx/adw";
import {
    GtkButton,
    GtkEntry,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkMenuButton,
    GtkPopover,
    GtkSearchBar,
    GtkSearchEntry,
    GtkStack,
    GtkStackPage,
} from "@gtkx/jsx/gtk";
import { act, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

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
            {hasTarget && (
                <GtkStackPage name="target">
                    <GtkLabel>Target</GtkLabel>
                </GtkStackPage>
            )}
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
            {hasTarget && (
                <GtkListBoxRow>
                    <GtkLabel>Target</GtkLabel>
                </GtkListBoxRow>
            )}
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
            {hasTarget && (
                <AdwLayout name="target">
                    <GtkLabel>Target</GtkLabel>
                </AdwLayout>
            )}
        </>
    );
};

describe("controlled parents whose child component updates independently", () => {
    it("selects a newly added stack page", async () => {
        const ref = createRef<Gtk.Stack>();
        await render(
            <GtkStack ref={ref} visibleChildName="target">
                <GrowingPages />
            </GtkStack>,
        );
        await userEvent.click(screen.getByText("Add page"));
        expect(ref.current?.getVisibleChildName()).toBe("target");
    });

    it("selects a newly added list row", async () => {
        const ref = createRef<Gtk.ListBox>();
        await render(
            <GtkListBox ref={ref} selectedIndex={1}>
                <GrowingRows />
            </GtkListBox>,
        );
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

type OpenStateCase<T extends GObject.Object> = {
    name: string;
    render: (ref: RefObject<T | null>, open: boolean | undefined) => ReactNode;
    read: (object: T) => boolean;
    write: (object: T, open: boolean) => void;
};

const openStateCase = <T extends GObject.Object>(entry: OpenStateCase<T>): OpenStateCase<GObject.Object> =>
    entry as OpenStateCase<GObject.Object>;

const TabOverviewWithPage = ({
    overviewRef,
    open,
}: {
    overviewRef: RefObject<Adw.TabOverview | null>;
    open: boolean | undefined;
}) => {
    const [view, setView] = useState<Adw.TabView | null>(null);

    return (
        <AdwTabOverview ref={overviewRef} view={view ?? undefined} open={view === null ? undefined : open}>
            <AdwTabView ref={setView}>
                <AdwTabPage title="Page">
                    <GtkLabel>Page</GtkLabel>
                </AdwTabPage>
            </AdwTabView>
        </AdwTabOverview>
    );
};

const OPEN_STATE_CASES = [
    openStateCase<Adw.OverlaySplitView>({
        name: "AdwOverlaySplitView showSidebar",
        render: (ref, open) => (
            <AdwOverlaySplitView ref={ref} collapsed showSidebar={open} sidebar={<GtkLabel>Sidebar</GtkLabel>}>
                <GtkLabel>Content</GtkLabel>
            </AdwOverlaySplitView>
        ),
        read: (view) => view.getShowSidebar(),
        write: (view, open) => view.setShowSidebar(open),
    }),
    openStateCase<Adw.NavigationSplitView>({
        name: "AdwNavigationSplitView showContent",
        render: (ref, open) => (
            <AdwNavigationSplitView
                ref={ref}
                collapsed
                showContent={open}
                sidebar={
                    <AdwNavigationPage title="Sidebar">
                        <GtkLabel>Sidebar</GtkLabel>
                    </AdwNavigationPage>
                }
            >
                <AdwNavigationPage title="Content">
                    <GtkLabel>Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationSplitView>
        ),
        read: (view) => view.getShowContent(),
        write: (view, open) => view.setShowContent(open),
    }),
    openStateCase<Adw.BottomSheet>({
        name: "AdwBottomSheet open",
        render: (ref, open) => (
            <AdwBottomSheet ref={ref} open={open} onNotifyOpen={() => undefined} sheet={<GtkLabel>Sheet</GtkLabel>}>
                <GtkLabel>Content</GtkLabel>
            </AdwBottomSheet>
        ),
        read: (sheet) => sheet.getOpen(),
        write: (sheet, open) => sheet.setOpen(open),
    }),
    openStateCase<Adw.TabOverview>({
        name: "AdwTabOverview open",
        render: (ref, open) => <TabOverviewWithPage overviewRef={ref} open={open} />,
        read: (overview) => overview.getOpen(),
        write: (overview, open) => overview.setOpen(open),
    }),
    openStateCase<Gtk.SearchBar>({
        name: "GtkSearchBar searchModeEnabled",
        render: (ref, open) => (
            <GtkSearchBar ref={ref} searchModeEnabled={open}>
                <GtkSearchEntry />
            </GtkSearchBar>
        ),
        read: (bar) => bar.getSearchMode(),
        write: (bar, open) => bar.setSearchMode(open),
    }),
];

const observeStderr = () => {
    const write = vi.spyOn(process.stderr, "write");
    onTestFinished(() => {
        write.mockRestore();
    });

    return write;
};

const requireObject = <T,>(ref: RefObject<T | null>): T => {
    if (ref.current === null) {
        throw new Error("Expected a rendered object");
    }

    return ref.current;
};

describe("open-state props after the user dismisses what they open", () => {
    it.each(OPEN_STATE_CASES)("restores $name the app still passes, and warns", async (entry) => {
        const ref = createRef<GObject.Object>();
        const stderr = observeStderr();
        await render(entry.render(ref, true));
        const object = requireObject(ref);
        await waitFor(() => {
            expect(entry.read(object)).toBe(true);
        });
        await act(() => {
            entry.write(object, false);
        });
        expect(entry.read(object)).toBe(true);
        expect(stderr).toHaveBeenCalled();
    });

    it.each(OPEN_STATE_CASES)("leaves $name to the widget when the prop is omitted", async (entry) => {
        const ref = createRef<GObject.Object>();
        await render(entry.render(ref, undefined));
        const object = requireObject(ref);
        await act(() => {
            entry.write(object, true);
        });
        await act(() => {
            entry.write(object, false);
        });
        expect(entry.read(object)).toBe(false);
    });

    it("keeps a dismissal the app takes from its notify handler", async () => {
        const ref = createRef<Gtk.SearchBar>();
        const App = () => {
            const [isSearching, setIsSearching] = useState(true);

            return (
                <GtkSearchBar
                    ref={ref}
                    searchModeEnabled={isSearching}
                    onNotifySearchModeEnabled={(enabled) => setIsSearching(enabled)}
                >
                    <GtkSearchEntry />
                </GtkSearchBar>
            );
        };
        await render(<App />);
        const bar = requireObject(ref);
        await act(() => {
            bar.setSearchMode(false);
        });
        expect(bar.getSearchMode()).toBe(false);
    });

    it("keeps a bottom sheet given open when the user asks to close it and nothing answers", async () => {
        const ref = createRef<Adw.BottomSheet>();
        const stderr = observeStderr();
        await render(
            <AdwBottomSheet ref={ref} open sheet={<GtkLabel>Sheet</GtkLabel>}>
                <GtkLabel>Content</GtkLabel>
            </AdwBottomSheet>,
        );
        const sheet = requireObject(ref);
        await act(() => {
            sheet.activateAction("sheet.close", null);
        });
        expect(sheet.getOpen()).toBe(true);
        expect(stderr).toHaveBeenCalled();
    });

    it("closes a bottom sheet given open when onNotifyOpen takes the new value", async () => {
        const ref = createRef<Adw.BottomSheet>();
        const App = () => {
            const [isOpen, setIsOpen] = useState(true);

            return (
                <AdwBottomSheet
                    ref={ref}
                    open={isOpen}
                    onNotifyOpen={(open) => setIsOpen(open)}
                    sheet={<GtkLabel>Sheet</GtkLabel>}
                >
                    <GtkLabel>Content</GtkLabel>
                </AdwBottomSheet>
            );
        };
        await render(<App />);
        const sheet = requireObject(ref);
        await act(() => {
            sheet.activateAction("sheet.close", null);
        });
        expect(sheet.getOpen()).toBe(false);
    });
});

describe("popovers the user dismisses", () => {
    it("closes a popover the app still passes visible and warns", async () => {
        const ref = createRef<Gtk.Popover>();
        const stderr = observeStderr();
        const Anchored = ({ isVisible }: { isVisible: boolean }) => (
            <GtkEntry text="Anchor">
                <GtkPopover ref={ref} visible={isVisible}>
                    <GtkLabel>Popover</GtkLabel>
                </GtkPopover>
            </GtkEntry>
        );
        const { rerender } = await render(<Anchored isVisible={false} />);
        await rerender(<Anchored isVisible />);
        const popover = requireObject(ref);
        expect(popover.getVisible()).toBe(true);
        await act(() => {
            popover.popdown();
        });
        expect(popover.getVisible()).toBe(false);
        await waitFor(() => {
            expect(stderr).toHaveBeenCalled();
        });
    });

    it("closes a menu button's popover while the app still passes active and warns", async () => {
        const ref = createRef<Gtk.MenuButton>();
        const stderr = observeStderr();
        const Menu = ({ isActive }: { isActive: boolean }) => (
            <GtkMenuButton ref={ref} label="Menu" active={isActive}>
                <GtkPopover>
                    <GtkLabel>Menu content</GtkLabel>
                </GtkPopover>
            </GtkMenuButton>
        );
        const { rerender } = await render(<Menu isActive={false} />);
        await rerender(<Menu isActive />);
        const button = requireObject(ref);
        expect(button.getActive()).toBe(true);
        await act(() => {
            button.popdown();
        });
        expect(button.getActive()).toBe(false);
        await waitFor(() => {
            expect(stderr).toHaveBeenCalled();
        });
    });
});
