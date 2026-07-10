import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwExpanderRow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkButton, GtkHeaderBar, GtkLabel, GtkListBox } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";

const twoLabelFragment = (firstRef: RefObject<Gtk.Label | null>, secondRef: RefObject<Gtk.Label | null>): ReactNode => (
    <>
        <GtkLabel ref={firstRef} label="First" />
        <GtkLabel ref={secondRef} label="Second" />
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
            prefix: <GtkLabel ref={prefixRef} label={prefixLabel} />,
            suffix: <GtkLabel ref={suffixRef} label={suffixLabel} />,
        }),
    );

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

    await render(toolbarWithBar(toolbarRef, bar, <GtkLabel ref={contentRef} label="Content" />));

    return { toolbarRef, contentRef };
};

const expectIndividualChildRemoval = async (
    renderApp: (showSecond: boolean) => ReactNode,
    firstRef: RefObject<Gtk.Label | null>,
    secondRef: RefObject<Gtk.Label | null>,
) => {
    const { rerender } = await render(renderApp(true));

    expect(firstRef.current).not.toBeNull();
    expect(secondRef.current).not.toBeNull();

    await rerender(renderApp(false));

    expect(firstRef.current).not.toBeNull();
    expect(secondRef.current).toBeNull();
};

describe("render - ContainerProp (1)", () => {
    describe("AdwActionRow (prefix/suffix) (1)", () => {
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
    });
});

describe("render - ContainerProp (2)", () => {
    describe("AdwActionRow (prefix/suffix) (2)", () => {
        it("removes prefix and suffix children", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const labelRefs = [createRef<Gtk.Label>(), createRef<Gtk.Label>(), createRef<Gtk.Label>()];

            function App({ count }: { count: number }) {
                return (
                    <GtkListBox>
                        <AdwActionRow
                            ref={rowRef}
                            title="Test Row"
                            suffix={Array.from({ length: count }, (_, i) => (
                                <GtkLabel key={`suffix-label-${i}`} ref={labelRefs[i]} label={`Label ${i}`} />
                            ))}
                        />
                    </GtkListBox>
                );
            }

            const { rerender } = await render(<App count={3} />);

            expect(labelRefs[0]?.current).not.toBeNull();
            expect(labelRefs[1]?.current).not.toBeNull();
            expect(labelRefs[2]?.current).not.toBeNull();

            await rerender(<App count={1} />);

            expect(labelRefs[0]?.current).not.toBeNull();
            expect(labelRefs[1]?.current).toBeNull();
            expect(labelRefs[2]?.current).toBeNull();
        });

        it("adds child as prefix via prefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();

            await render(actionRowInListBox(rowRef, { prefix: <GtkLabel ref={prefixRef} label="Prefix" /> }));

            expect(prefixRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (3)", () => {
    describe("AdwActionRow (prefix/suffix) (3)", () => {
        it("adds child as suffix via suffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const suffixRef = createRef<Gtk.Label>();

            await render(actionRowInListBox(rowRef, { suffix: <GtkLabel ref={suffixRef} label="Suffix" /> }));

            expect(suffixRef.current).not.toBeNull();
        });

        it("combines prefix and suffix", async () => {
            const { prefixRef, suffixRef } = await renderActionRowWithPrefixAndSuffix("Prefix", "Suffix");

            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (4)", () => {
    describe("AdwActionRow (prefix/suffix) (4)", () => {
        it("removes prefix child", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ showPrefix }: { showPrefix: boolean }) {
                return actionRowInListBox(rowRef, {
                    prefix: showPrefix ? <GtkLabel ref={prefixRef} label="Prefix" /> : null,
                    suffix: <GtkLabel ref={alwaysRef} label="Always" />,
                });
            }

            const { rerender } = await render(<App showPrefix={true} />);

            expect(prefixRef.current).not.toBeNull();
            expect(alwaysRef.current).not.toBeNull();

            await rerender(<App showPrefix={false} />);

            expect(prefixRef.current).toBeNull();
            expect(alwaysRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (5)", () => {
    describe("AdwActionRow (prefix/suffix) (5)", () => {
        it("adds multiple children as prefix via prefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(actionRowInListBox(rowRef, { prefix: twoLabelFragment(firstRef, secondRef) }));

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("adds multiple children as suffix via suffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(actionRowInListBox(rowRef, { suffix: twoLabelFragment(firstRef, secondRef) }));

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (6)", () => {
    describe("AdwActionRow (prefix/suffix) (6)", () => {
        it("removes individual children from prefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await expectIndividualChildRemoval(
                (showSecond) => (
                    <GtkListBox>
                        <AdwActionRow
                            ref={rowRef}
                            title="Test Row"
                            prefix={
                                <>
                                    <GtkLabel ref={firstRef} label="First" />
                                    {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                                </>
                            }
                        />
                    </GtkListBox>
                ),
                firstRef,
                secondRef,
            );
        });
    });
});

describe("render - ContainerProp (7)", () => {
    describe("AdwExpanderRow (rows/actions) (1)", () => {
        it("creates ExpanderRow widget", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(<AdwExpanderRow ref={ref} title="Test" />);

            expect(ref.current).not.toBeNull();
            expect(screen.getByText("Test")).toBeDefined();
        });

        it("updates title when prop changes", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            function App({ title }: { title: string }) {
                return <AdwExpanderRow ref={ref} title={title} />;
            }

            const { rerender } = await render(<App title="Initial" />);
            expect(ref.current?.getTitle()).toBe("Initial");

            await rerender(<App title="Updated" />);
            expect(ref.current?.getTitle()).toBe("Updated");
        });

        it("adds prefix and suffix widgets via compound components", async () => {
            await render(
                <AdwExpanderRow
                    title="Row"
                    prefix={<GtkButton label="Prefix" />}
                    suffix={<GtkButton label="Suffix" />}
                />,
            );

            expect(screen.getByText("Prefix")).toBeDefined();
            expect(screen.getByText("Suffix")).toBeDefined();
        });
    });
});

describe("render - ContainerProp (8)", () => {
    describe("AdwExpanderRow (rows/actions) (2)", () => {
        it("adds nested rows to ExpanderRow", async () => {
            const rowRef = createRef<Adw.ActionRow>();

            await render(<AdwExpanderRow title="Settings" rows={<AdwActionRow ref={rowRef} title="Option 1" />} />);

            expect(rowRef.current).not.toBeNull();
            expect(screen.getByText("Option 1")).toBeDefined();
        });

        it("adds multiple rows", async () => {
            await render(
                <AdwExpanderRow
                    title="Settings"
                    rows={
                        <>
                            <AdwActionRow title="Option 1" />
                            <AdwActionRow title="Option 2" />
                        </>
                    }
                />,
            );

            expect(screen.getByText("Option 1")).toBeDefined();
            expect(screen.getByText("Option 2")).toBeDefined();
        });
    });
});

describe("render - ContainerProp (9)", () => {
    describe("AdwExpanderRow (rows/actions) (3)", () => {
        it("removes nested rows when unmounted", async () => {
            const expanderRef = createRef<Adw.ExpanderRow>();

            function App({ showRow }: { showRow: boolean }) {
                return (
                    <AdwExpanderRow
                        ref={expanderRef}
                        title="Settings"
                        rows={
                            <>
                                <AdwActionRow title="Always" />
                                {showRow && <AdwActionRow title="Conditional" />}
                            </>
                        }
                    />
                );
            }

            const { rerender } = await render(<App showRow={true} />);
            expect(expanderRef.current).not.toBeNull();

            await rerender(<App showRow={false} />);
            expect(expanderRef.current).not.toBeNull();
        });

        it("adds action widgets to ExpanderRow", async () => {
            await render(<AdwExpanderRow title="Group" actions={<GtkButton label="Action" />} />);

            expect(screen.getByText("Action")).toBeDefined();
        });
    });
});

describe("render - ContainerProp (10)", () => {
    describe("AdwExpanderRow (rows/actions) (4)", () => {
        it("adds multiple action widgets", async () => {
            await render(
                <AdwExpanderRow
                    title="Group"
                    actions={
                        <>
                            <GtkButton label="Action 1" />
                            <GtkButton label="Action 2" />
                        </>
                    }
                />,
            );

            expect(screen.getByText("Action 1")).toBeDefined();
            expect(screen.getByText("Action 2")).toBeDefined();
        });

        it("handles multiple rows and actions together", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(
                <AdwExpanderRow
                    ref={ref}
                    title="Complex"
                    actions={
                        <>
                            <GtkButton label="Action 1" />
                            <GtkButton label="Action 2" />
                        </>
                    }
                    rows={
                        <>
                            <AdwActionRow title="Row 1" />
                            <AdwActionRow title="Row 2" />
                            <AdwActionRow title="Row 3" />
                        </>
                    }
                />,
            );

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (11)", () => {
    describe("GtkHeaderBar (start/end) (1)", () => {
        it("packs child at start via start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();

            await render(headerBarWithPack(headerBarRef, { start: <GtkLabel ref={startRef} label="Start" /> }));

            expect(startRef.current).not.toBeNull();
            expect(screen.getByText("Start")).toBeDefined();
        });

        it("packs child at end via end", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const endRef = createRef<Gtk.Label>();

            await render(headerBarWithPack(headerBarRef, { end: <GtkLabel ref={endRef} label="End" /> }));

            expect(endRef.current).not.toBeNull();
            expect(screen.getByText("End")).toBeDefined();
        });
    });
});

describe("render - ContainerProp (12)", () => {
    describe("GtkHeaderBar (start/end) (2)", () => {
        it("combines start and end", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const endRef = createRef<Gtk.Label>();

            await render(
                headerBarWithPack(headerBarRef, {
                    start: <GtkLabel ref={startRef} label="Start" />,
                    end: <GtkLabel ref={endRef} label="End" />,
                }),
            );

            expect(startRef.current).not.toBeNull();
            expect(endRef.current).not.toBeNull();
        });

        it("removes packed child", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ showStart }: { showStart: boolean }) {
                return (
                    <GtkHeaderBar
                        ref={headerBarRef}
                        titleWidget={<GtkLabel ref={alwaysRef} label="Always" />}
                        start={showStart ? <GtkLabel ref={startRef} label="Start" /> : null}
                    />
                );
            }

            const { rerender } = await render(<App showStart={true} />);

            expect(startRef.current).not.toBeNull();
            expect(alwaysRef.current).not.toBeNull();

            await rerender(<App showStart={false} />);

            expect(startRef.current).toBeNull();
            expect(alwaysRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (13)", () => {
    describe("GtkHeaderBar (start/end) (3)", () => {
        it("packs multiple children at start via start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(headerBarWithPack(headerBarRef, { start: twoLabelFragment(firstRef, secondRef) }));

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("packs multiple children at end via end", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(headerBarWithPack(headerBarRef, { end: twoLabelFragment(firstRef, secondRef) }));

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (14)", () => {
    describe("GtkHeaderBar (start/end) (4)", () => {
        it("swaps keyed children in start without duplication", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showBack }: { showBack: boolean }) {
                return (
                    <GtkHeaderBar
                        ref={headerBarRef}
                        start={
                            <>
                                {showBack ? (
                                    <GtkButton key="back" label="Back" />
                                ) : (
                                    <GtkButton key="search" label="Search" />
                                )}
                                <GtkButton label="Delete" />
                            </>
                        }
                    />
                );
            }

            const { rerender } = await render(<App showBack={false} />);

            const headerBar = headerBarRef.current;
            if (headerBar === null) throw new Error("expected the header bar to be mounted");
            const buttonCount = (): number => within(headerBar).getAllByRole(Gtk.AccessibleRole.BUTTON).length;

            const initialCount = buttonCount();

            await rerender(<App showBack={true} />);

            expect(buttonCount()).toBe(initialCount);

            await rerender(<App showBack={false} />);

            expect(buttonCount()).toBe(initialCount);
        });
    });
});

describe("render - ContainerProp (15)", () => {
    describe("GtkHeaderBar (start/end) (5)", () => {
        it("reorders children in start via insertBefore", async () => {
            function App({ order }: { order: "ab" | "ba" }) {
                return (
                    <GtkHeaderBar
                        start={
                            order === "ab" ? (
                                <>
                                    <GtkButton key="a" label="A" />
                                    <GtkButton key="b" label="B" />
                                </>
                            ) : (
                                <>
                                    <GtkButton key="b" label="B" />
                                    <GtkButton key="a" label="A" />
                                </>
                            )
                        }
                    />
                );
            }

            const { rerender } = await render(<App order="ab" />);

            expect(screen.getByText("A")).toBeDefined();
            expect(screen.getByText("B")).toBeDefined();

            await rerender(<App order="ba" />);

            expect(screen.getByText("A")).toBeDefined();
            expect(screen.getByText("B")).toBeDefined();
        });
    });
});

describe("render - ContainerProp (16)", () => {
    describe("GtkHeaderBar (start/end) (6)", () => {
        it("removes individual children from start", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await expectIndividualChildRemoval(
                (showSecond) => (
                    <GtkHeaderBar
                        ref={headerBarRef}
                        start={
                            <>
                                <GtkLabel ref={firstRef} label="First" />
                                {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                            </>
                        }
                    />
                ),
                firstRef,
                secondRef,
            );
        });
    });
});

describe("render - ContainerProp (17)", () => {
    describe("AdwToolbarView (topBar/bottomBar) (1)", () => {
        it("adds child to top bar via topBar", async () => {
            const { toolbarRef, contentRef } = await renderToolbarWithSingleBar({ topBar: <AdwHeaderBar /> });

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });

        it("adds child to bottom bar via bottomBar", async () => {
            const { toolbarRef, contentRef } = await renderToolbarWithSingleBar({ bottomBar: <AdwHeaderBar /> });

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });
    });
});

describe("render - ContainerProp (18)", () => {
    describe("AdwToolbarView (topBar/bottomBar) (2)", () => {
        it("handles multiple top bars", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const secondTopRef = createRef<Gtk.Label>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView
                    ref={toolbarRef}
                    topBar={
                        <>
                            <AdwHeaderBar />
                            <GtkLabel ref={secondTopRef} label="Second Top Bar" />
                        </>
                    }
                >
                    <GtkLabel ref={contentRef} label="Content" />
                </AdwToolbarView>,
            );

            expect(secondTopRef.current).not.toBeNull();
            expect(contentRef.current).not.toBeNull();
        });

        it("handles dynamic toolbar addition", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();

            function App({ showTop }: { showTop: boolean }) {
                return (
                    <AdwToolbarView ref={toolbarRef} topBar={showTop ? <AdwHeaderBar /> : null}>
                        <GtkLabel ref={contentRef} label="Content" />
                    </AdwToolbarView>
                );
            }

            const { rerender } = await render(<App showTop={false} />);
            await rerender(<App showTop={true} />);

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });
    });
});
