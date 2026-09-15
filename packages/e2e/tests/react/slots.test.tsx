import type { ReactNode, Ref, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwExpanderRow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import {
    GtkApplicationWindow,
    GtkBox,
    GtkButton,
    GtkEntry,
    GtkHeaderBar,
    GtkLabel,
    GtkListBox,
    GtkMenuButton,
    GtkPaned,
    GtkPopover,
    GtkStack,
} from "@gtkx/jsx/gtk";
import { createPortal, useApplication } from "@gtkx/react";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { createApplicationRenderer } from "../helpers/application-render.js";

const renderApplication = createApplicationRenderer("org.gtkx.portaltest");

const mountedRef = <T,>(ref: RefObject<T | null>): T => {
    const widget = ref.current;

    if (widget === null) {
        throw new Error("expected the widget to be mounted");
    }

    return widget;
};

const expectPanedStartChild = async (label: string) => {
    const panedRef = createRef<Gtk.Paned>();
    const labelRef = createRef<Gtk.Label>();
    await render(<GtkPaned ref={panedRef} startChild={<GtkLabel ref={labelRef}>{label}</GtkLabel>} />);
    expect(panedRef.current).toContainElement(labelRef.current);
    expect(panedRef.current).toHaveObjectProperty("startChild", labelRef.current);
};

const twoLabelFragment = (firstRef: RefObject<Gtk.Label | null>, secondRef: RefObject<Gtk.Label | null>): ReactNode => (
    <>
        <GtkLabel ref={firstRef}>First</GtkLabel>
        <GtkLabel ref={secondRef}>Second</GtkLabel>
    </>
);

const actionRowInListBox = (
    ref: RefObject<Adw.ActionRow | null>,
    slots: { prefix?: ReactNode; suffix?: ReactNode },
): ReactNode => (
    <GtkListBox>
        <AdwActionRow ref={ref} title="Test Row" prefix={slots.prefix} suffix={slots.suffix} />
    </GtkListBox>
);

const renderActionRowWithPrefixAndSuffix = async (prefixLabel: string, suffixLabel: string) => {
    const rowRef = createRef<Adw.ActionRow>();
    const prefixRef = createRef<Gtk.Label>();
    const suffixRef = createRef<Gtk.Label>();

    await render(
        actionRowInListBox(rowRef, {
            prefix: <GtkLabel ref={prefixRef}>{prefixLabel}</GtkLabel>,
            suffix: <GtkLabel ref={suffixRef}>{suffixLabel}</GtkLabel>,
        }),
    );

    expect(rowRef.current).toContainElement(prefixRef.current);
    expect(rowRef.current).toContainElement(suffixRef.current);

    return { rowRef, prefixRef, suffixRef };
};

const headerBarWithPack = (
    ref: RefObject<Gtk.HeaderBar | null>,
    slots: { start?: ReactNode; end?: ReactNode },
): ReactNode => <GtkHeaderBar ref={ref} start={slots.start} end={slots.end} />;

const toolbarWithBar = (
    ref: RefObject<Adw.ToolbarView | null>,
    bar: { topBar?: ReactNode; bottomBar?: ReactNode },
    content: ReactNode,
): ReactNode => (
    <AdwToolbarView ref={ref} topBar={bar.topBar} bottomBar={bar.bottomBar}>
        {content}
    </AdwToolbarView>
);

const renderToolbarWithSingleBar = async (bar: { topBar?: ReactNode; bottomBar?: ReactNode }) => {
    const toolbarRef = createRef<Adw.ToolbarView>();
    const contentRef = createRef<Gtk.Label>();
    await render(toolbarWithBar(toolbarRef, bar, <GtkLabel ref={contentRef}>Content</GtkLabel>));

    return { toolbarRef, contentRef };
};

const expectTwoLabelSlotMounts = async (build: (labels: ReactNode) => ReactNode): Promise<void> => {
    const firstRef = createRef<Gtk.Label>();
    const secondRef = createRef<Gtk.Label>();
    await render(build(twoLabelFragment(firstRef, secondRef)));
    const first = mountedRef(firstRef);
    const second = mountedRef(secondRef);
    expect(first).toBeRooted();
    expect(second).toBeRooted();
    expect(first.getParent()).toBe(second.getParent());
};

const expectIndividualChildRemoval = async (
    renderApp: (hasSecond: boolean) => ReactNode,
    firstRef: RefObject<Gtk.Label | null>,
    secondRef: RefObject<Gtk.Label | null>,
) => {
    const { rerender } = await render(renderApp(true));
    const first = mountedRef(firstRef);
    const second = mountedRef(secondRef);
    const parent = first.getParent();
    expect(first).toBeRooted();
    expect(second).toBeRooted();
    expect(second.getParent()).toBe(parent);
    await rerender(renderApp(false));
    expect(firstRef.current).toBe(first);
    expect(first.getParent()).toBe(parent);
    expect(first).toBeRooted();
    expect(secondRef.current).toBeNull();
    expect(second.getParent()).toBeNull();
};

function SwapKeyedApp({
    headerBarRef,
    shouldShowBack,
}: {
    headerBarRef: RefObject<Gtk.HeaderBar | null>;
    shouldShowBack: boolean;
}) {
    return (
        <GtkHeaderBar
            ref={headerBarRef}
            start={(
                <>
                    {shouldShowBack ? <GtkButton key="back" label="Back" /> : <GtkButton key="search" label="Search" />}
                    <GtkButton label="Delete" />
                </>
            )}
        />
    );
}

function App({ order }: { order: "ab" | "ba" }) {
    return (
        <GtkHeaderBar
            start={
                order === "ab"
                    ? (
                            <>
                                <GtkButton key="a" label="A" />
                                <GtkButton key="b" label="B" />
                            </>
                        )
                    : (
                            <>
                                <GtkButton key="b" label="B" />
                                <GtkButton key="a" label="A" />
                            </>
                        )
            }
        />
    );
}

const Portal = ({ children, portalKey }: { children: ReactNode; portalKey?: string | undefined }) => {
    const app = useApplication();

    return <>{createPortal(children, app, portalKey)}</>;
};

const plainBox = (ref: Ref<Gtk.Box>): ReactNode => <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />;

const stackChildOrder = (stack: Gtk.Stack): string[] => {
    const names: string[] = [];
    let child = stack.getFirstChild();

    while (child !== null) {
        if (child instanceof Gtk.Label) {
            names.push(child.getLabel());
        }

        child = child.getNextSibling();
    }

    return names;
};

const renderPortalIntoBox = async (
    content: (box: Gtk.Box) => ReactNode,
    boxTree: (ref: Ref<Gtk.Box>) => ReactNode = plainBox,
): Promise<Gtk.Box> => {
    const boxRef = createRef<Gtk.Box>();

    function App() {
        const box = boxRef.current;

        return (
            <>
                {boxTree(boxRef)}
                {box && content(box)}
            </>
        );
    }

    const { rerender } = await render(<App />);
    await rerender(<App />);

    return boxRef.current as Gtk.Box;
};

const renderPortalWindow = (title: string, portalKey?: string) =>
    renderApplication(
        <Portal portalKey={portalKey}>
            <GtkApplicationWindow title={title} />
        </Portal>,
    );

function OptionalPortal({ shouldShowPortal }: { shouldShowPortal: boolean }) {
    const app = useApplication();

    return <>{shouldShowPortal && createPortal(<GtkApplicationWindow title="Portal" />, app)}</>;
}

function TitledPortal({ title }: { title: string }) {
    const app = useApplication();

    return <>{createPortal(<GtkApplicationWindow title={title} />, app)}</>;
}

describe("render - Slot", () => {
    it("unparents a popover when its widget subtree unmounts", async () => {
        const entryRef = createRef<Gtk.Entry>();
        const popoverRef = createRef<Gtk.Popover>();
        const { unmount } = await render(
            <GtkBox>
                <GtkEntry ref={entryRef}>
                    <GtkPopover ref={popoverRef} />
                </GtkEntry>
            </GtkBox>,
        );
        const entry = entryRef.current;
        const popover = popoverRef.current;

        if (entry === null || popover === null) {
            throw new Error("expected the entry and popover to be mounted");
        }

        expect(popover.getParent()).toBe(entry);
        await unmount();
        expect(popover.getParent()).toBeNull();
    });

    it("sets slot child via ReactNode prop", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        await render(
            <GtkHeaderBar ref={headerBarRef} titleWidget={<GtkLabel ref={titleRef}>Custom Title</GtkLabel>} />,
        );

        expect(headerBarRef.current).toContainElement(titleRef.current);
        expect(headerBarRef.current).toHaveObjectProperty("titleWidget", titleRef.current);
    });

    it("calls setSlotName(widget) on parent", async () => {
        await expectPanedStartChild("Start Content");
    });

    it("accepts a constructed widget instance through a slot prop", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const title = new Gtk.Label({ label: "Imperative Title" });
        await render(<GtkHeaderBar ref={headerBarRef} titleWidget={title} />);
        expect(headerBarRef.current).toHaveObjectProperty("titleWidget", title);
    });

    it("clears slot when child removed", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const titleRef = createRef<Gtk.Label>();

        function App({ shouldShowTitle }: { shouldShowTitle: boolean }) {
            return (
                <GtkHeaderBar
                    ref={headerBarRef}
                    titleWidget={shouldShowTitle ? <GtkLabel ref={titleRef}>Title</GtkLabel> : undefined}
                />
            );
        }

        const { rerender } = await render(<App shouldShowTitle />);
        const headerBar = mountedRef(headerBarRef);
        const title = mountedRef(titleRef);
        expect(headerBar).toContainElement(title);
        expect(headerBar.getTitleWidget()).toBe(title);
        await rerender(<App shouldShowTitle={false} />);
        expect(headerBarRef.current).toBe(headerBar);
        expect(headerBar.getTitleWidget()).toBeNull();
        expect(titleRef.current).toBeNull();
        expect(title.getParent()).toBeNull();
    });

    it("updates slot when child changes", async () => {
        const headerBarRef = createRef<Gtk.HeaderBar>();
        const label1Ref = createRef<Gtk.Label>();
        const label2Ref = createRef<Gtk.Label>();

        function App({ isFirst }: { isFirst: boolean }) {
            return (
                <GtkHeaderBar
                    ref={headerBarRef}
                    titleWidget={
                        isFirst
                            ? (
                                    <GtkLabel ref={label1Ref} key="first">
                                        First Title
                                    </GtkLabel>
                                )
                            : (
                                    <GtkLabel ref={label2Ref} key="second">
                                        Second Title
                                    </GtkLabel>
                                )
                    }
                />
            );
        }

        const { rerender } = await render(<App isFirst={true} />);
        const headerBar = mountedRef(headerBarRef);
        const first = mountedRef(label1Ref);
        expect(headerBar).toContainElement(first);
        expect(headerBar.getTitleWidget()).toBe(first);
        await rerender(<App isFirst={false} />);
        expect(headerBarRef.current).toBe(headerBar);
        expect(headerBar).toContainElement(label2Ref.current);
        expect(headerBar.getTitleWidget()).toBe(label2Ref.current);
        expect(label1Ref.current).toBeNull();
        expect(first.getParent()).toBeNull();
    });

    it("handles Paned.StartChild slot", async () => {
        await expectPanedStartChild("Start Child");
    });

    it("handles MenuButton.Popover slot", async () => {
        const menuButtonRef = createRef<Gtk.MenuButton>();
        const popoverRef = createRef<Gtk.Popover>();

        await render(
            <GtkMenuButton
                ref={menuButtonRef}
                popover={(
                    <GtkPopover ref={popoverRef}>
                        <GtkLabel>Popover Content</GtkLabel>
                    </GtkPopover>
                )}
            />,
        );

        expect(menuButtonRef.current).toContainElement(popoverRef.current);
        expect(menuButtonRef.current).toHaveObjectProperty("popover", popoverRef.current);
    });

    it("handles multiple slots on same parent", async () => {
        const panedRef = createRef<Gtk.Paned>();
        const startRef = createRef<Gtk.Label>();
        const endRef = createRef<Gtk.Label>();

        await render(
            <GtkPaned
                ref={panedRef}
                startChild={<GtkLabel ref={startRef}>Start</GtkLabel>}
                endChild={<GtkLabel ref={endRef}>End</GtkLabel>}
            />,
        );

        expect(panedRef.current).toContainElement(startRef.current);
        expect(panedRef.current).toContainElement(endRef.current);
        expect(panedRef.current).toHaveObjectProperty("startChild", startRef.current);
        expect(panedRef.current).toHaveObjectProperty("endChild", endRef.current);
    });
});

describe("render - ContainerProp", () => {
    describe("AdwActionRow (prefix/suffix)", () => {
        it("creates ActionRow widget", async () => {
            const ref = createRef<Adw.ActionRow>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={ref} title="Test Row" />
                </GtkListBox>,
            );

            expect(ref.current).not.toBeNull();
        });

        it("appends prefix and suffix children", async () => {
            const { rowRef, prefixRef, suffixRef } = await renderActionRowWithPrefixAndSuffix("First", "Second");
            expect(rowRef.current).not.toBeNull();
            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });

        it("removes suffix children while retaining the first", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const labelRefs = [firstRef, createRef<Gtk.Label>(), createRef<Gtk.Label>()];

            function App({ count }: { count: number }) {
                return (
                    <GtkListBox>
                        <AdwActionRow
                            ref={rowRef}
                            title="Test Row"
                            suffix={Array.from({ length: count }, (_, i) => (
                                <GtkLabel key={`suffix-label-${String(i)}`} ref={labelRefs[i]}>
                                    Label
                                    {" "}
                                    {i}
                                </GtkLabel>
                            ))}
                        />
                    </GtkListBox>
                );
            }

            const { rerender } = await render(<App count={3} />);
            const row = mountedRef(rowRef);
            const first = mountedRef(firstRef);
            const labels = labelRefs.map((labelRef) => mountedRef(labelRef));
            for (const label of labels) {
                expect(row).toContainElement(label);
            }
            await rerender(<App count={1} />);
            expect(rowRef.current).toBe(row);
            expect(firstRef.current).toBe(first);
            expect(row).toContainElement(first);
            for (const label of labels.slice(1)) {
                expect(label.getParent()).toBeNull();
            }
            expect(labelRefs[1]?.current).toBeNull();
            expect(labelRefs[2]?.current).toBeNull();
        });

        it("adds child as prefix via prefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            await render(actionRowInListBox(rowRef, { prefix: <GtkLabel ref={prefixRef}>Prefix</GtkLabel> }));
            expect(rowRef.current).toContainElement(prefixRef.current);
        });

        it("adds child as suffix via suffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const suffixRef = createRef<Gtk.Label>();
            await render(actionRowInListBox(rowRef, { suffix: <GtkLabel ref={suffixRef}>Suffix</GtkLabel> }));
            expect(rowRef.current).toContainElement(suffixRef.current);
        });

        it("combines prefix and suffix", async () => {
            const { prefixRef, suffixRef } = await renderActionRowWithPrefixAndSuffix("Prefix", "Suffix");
            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });

        it("removes prefix child", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ shouldShowPrefix }: { shouldShowPrefix: boolean }) {
                return actionRowInListBox(rowRef, {
                    prefix: shouldShowPrefix ? <GtkLabel ref={prefixRef}>Prefix</GtkLabel> : null,
                    suffix: <GtkLabel ref={alwaysRef}>Always</GtkLabel>,
                });
            }

            const { rerender } = await render(<App shouldShowPrefix={true} />);
            const row = mountedRef(rowRef);
            const prefix = mountedRef(prefixRef);
            const always = mountedRef(alwaysRef);
            expect(row).toContainElement(prefix);
            expect(row).toContainElement(always);
            await rerender(<App shouldShowPrefix={false} />);
            expect(rowRef.current).toBe(row);
            expect(prefixRef.current).toBeNull();
            expect(prefix.getParent()).toBeNull();
            expect(alwaysRef.current).toBe(always);
            expect(row).toContainElement(always);
        });

        it("adds multiple children as prefix via prefix", async () => {
            await expectTwoLabelSlotMounts((labels) =>
                actionRowInListBox(createRef<Adw.ActionRow>(), { prefix: labels }),
            );
        });

        it("adds multiple children as suffix via suffix", async () => {
            await expectTwoLabelSlotMounts((labels) =>
                actionRowInListBox(createRef<Adw.ActionRow>(), { suffix: labels }),
            );
        });

        it("removes individual children from prefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await expectIndividualChildRemoval(
                (hasSecond) => (
                    <GtkListBox>
                        <AdwActionRow
                            ref={rowRef}
                            title="Test Row"
                            prefix={(
                                <>
                                    <GtkLabel ref={firstRef}>First</GtkLabel>
                                    {hasSecond && <GtkLabel ref={secondRef}>Second</GtkLabel>}
                                </>
                            )}
                        />
                    </GtkListBox>
                ),
                firstRef,
                secondRef,
            );
        });
    });

    describe("AdwExpanderRow (rows/suffix)", () => {
        it("creates ExpanderRow widget", async () => {
            const ref = createRef<Adw.ExpanderRow>();
            await render(<AdwExpanderRow ref={ref} title="Test" />);
            expect(ref.current).not.toBeNull();
            expect(screen.getByText("Test")).toBeRooted();
        });

        it("updates title when prop changes", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            function App({ title }: { title: string }) {
                return <AdwExpanderRow ref={ref} title={title} />;
            }

            const { rerender } = await render(<App title="Initial" />);
            expect(ref.current).toHaveObjectProperty("title", "Initial");
            await rerender(<App title="Updated" />);
            expect(ref.current).toHaveObjectProperty("title", "Updated");
        });

        it("adds prefix and suffix widgets via compound components", async () => {
            await render(
                <AdwExpanderRow
                    title="Row"
                    prefix={<GtkButton label="Prefix" />}
                    suffix={<GtkButton label="Suffix" />}
                />,
            );

            expect(screen.getByText("Prefix")).toAppearBefore(screen.getByText("Suffix"));
        });

        it("adds nested rows to ExpanderRow", async () => {
            const rowRef = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow expanded title="Settings" rows={<AdwActionRow ref={rowRef} title="Option 1" />} />,
            );

            expect(rowRef.current).toContainElement(await screen.findByText("Option 1"));
        });

        it("adds multiple rows", async () => {
            await render(
                <AdwExpanderRow
                    expanded
                    title="Settings"
                    rows={(
                        <>
                            <AdwActionRow title="Option 1" />
                            <AdwActionRow title="Option 2" />
                        </>
                    )}
                />,
            );

            expect(await screen.findByText("Option 1")).toAppearBefore(await screen.findByText("Option 2"));
        });

        it("removes nested rows when unmounted", async () => {
            const expanderRef = createRef<Adw.ExpanderRow>();
            const alwaysRef = createRef<Adw.ActionRow>();
            const conditionalRef = createRef<Adw.ActionRow>();

            function App({ shouldShowRow }: { shouldShowRow: boolean }) {
                return (
                    <AdwExpanderRow
                        ref={expanderRef}
                        expanded
                        title="Settings"
                        rows={(
                            <>
                                <AdwActionRow ref={alwaysRef} title="Always" />
                                {shouldShowRow && <AdwActionRow ref={conditionalRef} title="Conditional" />}
                            </>
                        )}
                    />
                );
            }

            const { rerender } = await render(<App shouldShowRow={true} />);
            const expander = mountedRef(expanderRef);
            const always = mountedRef(alwaysRef);
            const conditional = mountedRef(conditionalRef);
            expect(expander).toContainElement(always);
            expect(expander).toContainElement(conditional);
            await rerender(<App shouldShowRow={false} />);
            expect(expanderRef.current).toBe(expander);
            expect(alwaysRef.current).toBe(always);
            expect(expander).toContainElement(always);
            expect(conditionalRef.current).toBeNull();
            expect(conditional.getParent()).toBeNull();
            expect(within(expander).queryByText("Conditional")).toBeNull();
        });

        it("adds action widgets to ExpanderRow", async () => {
            await render(<AdwExpanderRow title="Group" suffix={<GtkButton label="Action" />} />);
            expect(screen.getByText("Action")).toBeRooted();
        });

        it("adds multiple action widgets", async () => {
            await render(
                <AdwExpanderRow
                    title="Group"
                    suffix={(
                        <>
                            <GtkButton label="Action 1" />
                            <GtkButton label="Action 2" />
                        </>
                    )}
                />,
            );

            expect(screen.getByText("Action 1")).toBeRooted();
            expect(screen.getByText("Action 2")).toBeRooted();
            expect(screen.getAllByRole(Gtk.AccessibleRole.BUTTON)).toHaveLength(2);
        });

        it("handles multiple rows and suffixes together", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(
                <AdwExpanderRow
                    ref={ref}
                    expanded
                    title="Complex"
                    suffix={(
                        <>
                            <GtkButton label="Action 1" />
                            <GtkButton label="Action 2" />
                        </>
                    )}
                    rows={(
                        <>
                            <AdwActionRow title="Row 1" />
                            <AdwActionRow title="Row 2" />
                            <AdwActionRow title="Row 3" />
                        </>
                    )}
                />,
            );

            const expander = mountedRef(ref);
            const queries = within(expander);
            const first = await queries.findByText("Row 1");
            const second = await queries.findByText("Row 2");
            const third = await queries.findByText("Row 3");
            expect(first).toAppearBefore(second);
            expect(second).toAppearBefore(third);
            expect(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Action 1" })).toBeRooted();
            expect(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Action 2" })).toBeRooted();
        });
    });

    describe("GtkHeaderBar (start/end)", () => {
        it("packs child at start via start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            await render(headerBarWithPack(headerBarRef, { start: <GtkLabel ref={startRef}>Start</GtkLabel> }));
            expect(headerBarRef.current).toContainElement(startRef.current);
            expect(screen.getByText("Start")).toBeRooted();
        });

        it("packs child at end via end", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const endRef = createRef<Gtk.Label>();
            await render(headerBarWithPack(headerBarRef, { end: <GtkLabel ref={endRef}>End</GtkLabel> }));
            expect(headerBarRef.current).toContainElement(endRef.current);
            expect(screen.getByText("End")).toBeRooted();
        });

        it("combines start and end", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const endRef = createRef<Gtk.Label>();

            await render(
                headerBarWithPack(headerBarRef, {
                    start: <GtkLabel ref={startRef}>Start</GtkLabel>,
                    end: <GtkLabel ref={endRef}>End</GtkLabel>,
                }),
            );

            expect(headerBarRef.current).toContainElement(startRef.current);
            expect(headerBarRef.current).toContainElement(endRef.current);
        });

        it("removes packed child", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ shouldShowStart }: { shouldShowStart: boolean }) {
                return (
                    <GtkHeaderBar
                        ref={headerBarRef}
                        titleWidget={<GtkLabel ref={alwaysRef}>Always</GtkLabel>}
                        start={shouldShowStart ? <GtkLabel ref={startRef}>Start</GtkLabel> : null}
                    />
                );
            }

            const { rerender } = await render(<App shouldShowStart={true} />);
            const headerBar = mountedRef(headerBarRef);
            const start = mountedRef(startRef);
            const always = mountedRef(alwaysRef);
            expect(headerBar).toContainElement(start);
            expect(headerBar).toContainElement(always);
            await rerender(<App shouldShowStart={false} />);
            expect(headerBarRef.current).toBe(headerBar);
            expect(startRef.current).toBeNull();
            expect(start.getParent()).toBeNull();
            expect(alwaysRef.current).toBe(always);
            expect(headerBar).toContainElement(always);
        });

        it("packs multiple children at start via start", async () => {
            await expectTwoLabelSlotMounts((labels) =>
                headerBarWithPack(createRef<Gtk.HeaderBar>(), { start: labels }),
            );
        });

        it("packs multiple children at end via end", async () => {
            await expectTwoLabelSlotMounts((labels) => headerBarWithPack(createRef<Gtk.HeaderBar>(), { end: labels }));
        });

        it("swaps keyed children in start without duplication", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const { rerender } = await render(<SwapKeyedApp headerBarRef={headerBarRef} shouldShowBack={false} />);
            const headerBar = headerBarRef.current;

            if (headerBar === null) {
                throw new Error("expected the header bar to be mounted");
            }

            const queries = within(headerBar);
            const search = queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Search" });
            const retainedButton = queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" });
            const initialCount = queries.getAllByRole(Gtk.AccessibleRole.BUTTON).length;
            await rerender(<SwapKeyedApp headerBarRef={headerBarRef} shouldShowBack={true} />);
            expect(headerBarRef.current).toBe(headerBar);
            const back = queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" });
            expect(queries.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Search" })).toBeNull();
            expect(search.getParent()).toBeNull();
            expect(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })).toBe(retainedButton);
            expect(queries.getAllByRole(Gtk.AccessibleRole.BUTTON)).toHaveLength(initialCount);
            await rerender(<SwapKeyedApp headerBarRef={headerBarRef} shouldShowBack={false} />);
            expect(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Search" })).toBeRooted();
            expect(queries.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" })).toBeNull();
            expect(back.getParent()).toBeNull();
            expect(queries.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Delete" })).toBe(retainedButton);
            expect(queries.getAllByRole(Gtk.AccessibleRole.BUTTON)).toHaveLength(initialCount);
        });

        it("reorders children in start via insertBefore", async () => {
            const { rerender } = await render(<App order="ab" />);
            expect(screen.getByText("A")).toAppearBefore(screen.getByText("B"));
            await rerender(<App order="ba" />);
            expect(screen.getByText("B")).toAppearBefore(screen.getByText("A"));
        });

        it("removes individual children from start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await expectIndividualChildRemoval(
                (hasSecond) => (
                    <GtkHeaderBar
                        ref={headerBarRef}
                        start={(
                            <>
                                <GtkLabel ref={firstRef}>First</GtkLabel>
                                {hasSecond && <GtkLabel ref={secondRef}>Second</GtkLabel>}
                            </>
                        )}
                    />
                ),
                firstRef,
                secondRef,
            );
        });
    });

    describe("AdwToolbarView (topBar/bottomBar)", () => {
        it("adds child to top bar via topBar", async () => {
            const barRef = createRef<Adw.HeaderBar>();
            const { toolbarRef, contentRef } = await renderToolbarWithSingleBar({
                topBar: <AdwHeaderBar ref={barRef} />,
            });
            const toolbar = mountedRef(toolbarRef);
            expect(toolbar).toContainElement(barRef.current);
            expect(toolbar).toContainElement(contentRef.current);
            expect(toolbar.getContent()).toBe(contentRef.current);
            expect(toolbar.getTopBarHeight()).toBeGreaterThan(0);
        });

        it("adds child to bottom bar via bottomBar", async () => {
            const barRef = createRef<Adw.HeaderBar>();
            const { toolbarRef, contentRef } = await renderToolbarWithSingleBar({
                bottomBar: <AdwHeaderBar ref={barRef} />,
            });
            const toolbar = mountedRef(toolbarRef);
            expect(toolbar).toContainElement(barRef.current);
            expect(toolbar).toContainElement(contentRef.current);
            expect(toolbar.getContent()).toBe(contentRef.current);
            expect(toolbar.getBottomBarHeight()).toBeGreaterThan(0);
        });

        it("handles multiple top bars", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const firstTopRef = createRef<Adw.HeaderBar>();
            const secondTopRef = createRef<Gtk.Label>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView
                    ref={toolbarRef}
                    topBar={(
                        <>
                            <AdwHeaderBar ref={firstTopRef} />
                            <GtkLabel ref={secondTopRef}>Second Top Bar</GtkLabel>
                        </>
                    )}
                >
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </AdwToolbarView>,
            );

            expect(toolbarRef.current).toContainElement(firstTopRef.current);
            expect(toolbarRef.current).toContainElement(secondTopRef.current);
            expect(toolbarRef.current).toContainElement(contentRef.current);
            expect(firstTopRef.current).toAppearBefore(mountedRef(secondTopRef));
        });

        it("handles dynamic toolbar addition and removal", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();
            const topRef = createRef<Adw.HeaderBar>();

            function App({ shouldShowTop }: { shouldShowTop: boolean }) {
                return (
                    <AdwToolbarView ref={toolbarRef} topBar={shouldShowTop ? <AdwHeaderBar ref={topRef} /> : null}>
                        <GtkLabel ref={contentRef}>Content</GtkLabel>
                    </AdwToolbarView>
                );
            }

            const { rerender } = await render(<App shouldShowTop={false} />);
            const toolbar = mountedRef(toolbarRef);
            const content = mountedRef(contentRef);
            expect(topRef.current).toBeNull();
            expect(toolbar.getTopBarHeight()).toBe(0);
            await rerender(<App shouldShowTop={true} />);
            const top = mountedRef(topRef);
            expect(toolbarRef.current).toBe(toolbar);
            expect(toolbar).toContainElement(top);
            expect(toolbar.getTopBarHeight()).toBeGreaterThan(0);
            expect(contentRef.current).toBe(content);
            expect(toolbar.getContent()).toBe(content);
            await rerender(<App shouldShowTop={false} />);
            expect(toolbarRef.current).toBe(toolbar);
            expect(topRef.current).toBeNull();
            expect(top.getParent()).toBeNull();
            expect(toolbar.getTopBarHeight()).toBe(0);
            expect(contentRef.current).toBe(content);
            expect(toolbar.getContent()).toBe(content);
        });
    });
});

describe("createPortal", () => {
    it("renders window children into the application container", async () => {
        await renderPortalWindow("Portal Window");

        const portalWindow = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "Portal Window",
            hidden: true,
        });

        expect(portalWindow).toBeRooted();
    });

    it("renders children into a specific container widget", async () => {
        const box = await renderPortalIntoBox((target) => createPortal(<GtkLabel>In Portal</GtkLabel>, target));
        expect(box).toContainOneByText("In Portal");
    });

    it("keeps a portal child in place when sibling JSX children reorder", async () => {
        const stackRef = createRef<Gtk.Stack>();

        function App({ order }: { order: string[] }) {
            const stack = stackRef.current;

            return (
                <>
                    <GtkStack ref={stackRef}>
                        {order.map((name) => (
                            <GtkLabel key={name} label={name} />
                        ))}
                    </GtkStack>
                    {stack && createPortal(<GtkLabel label="portal" />, stack)}
                </>
            );
        }

        const { rerender } = await render(<App order={["a", "b"]} />);
        await rerender(<App order={["a", "b"]} />);
        expect(stackChildOrder(stackRef.current as Gtk.Stack)).toEqual(["a", "b", "portal"]);
        await rerender(<App order={["b", "a"]} />);
        expect(stackChildOrder(stackRef.current as Gtk.Stack)).toEqual(["b", "portal", "a"]);
    });

    it("retains a window for a stable portal key and remounts for a new key", async () => {
        const { rerender } = await renderPortalWindow("Keyed Window", "first");
        const first = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Keyed Window", hidden: true });
        await rerender(
            <Portal portalKey="first">
                <GtkApplicationWindow title="Updated Window" />
            </Portal>,
        );
        expect(screen.getByRole(Gtk.AccessibleRole.WINDOW, { name: "Updated Window", hidden: true })).toBe(first);
        await rerender(
            <Portal portalKey="second">
                <GtkApplicationWindow title="Replacement Window" />
            </Portal>,
        );
        const replacement = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "Replacement Window",
            hidden: true,
        });
        expect(replacement).not.toBe(first);
        expect(replacement).toBeRooted();
        expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Updated Window", hidden: true })).toBeNull();
        expect(screen.getAllByRole(Gtk.AccessibleRole.WINDOW, { hidden: true })).toEqual([replacement]);
    });

    it("unmounts portal children when portal is removed", async () => {
        const { rerender } = await renderApplication(<OptionalPortal shouldShowPortal={true} />);
        expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Portal", hidden: true })).toBeRooted();
        await rerender(<OptionalPortal shouldShowPortal={false} />);

        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.WINDOW, { name: "Portal", hidden: true })).toBeNull();
        });
    });

    it("updates portal children when props change", async () => {
        const { rerender } = await renderApplication(<TitledPortal title="First" />);
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "First", hidden: true });
        expect(window).toBeRooted();
        await rerender(<TitledPortal title="Second" />);
        expect(await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "Second", hidden: true })).toBe(window);
    });

    it("handles multiple portals to same container", async () => {
        const box = await renderPortalIntoBox((target) => (
            <>
                {createPortal(<GtkLabel>First</GtkLabel>, target)}
                {createPortal(<GtkLabel>Second</GtkLabel>, target)}
            </>
        ));

        const queries = within(box);
        expect(queries.getByText("First")).toAppearBefore(queries.getByText("Second"));
    });

    it("handles portal to nested container", async () => {
        const innerBox = await renderPortalIntoBox(
            (target) => createPortal(<GtkButton label="Nested" />, target),
            (ref) => (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkBox ref={ref} orientation={Gtk.Orientation.VERTICAL} />
                </GtkBox>
            ),
        );

        expect(innerBox).toContainOneByRole(Gtk.AccessibleRole.BUTTON, { name: "Nested" });
    });
});
