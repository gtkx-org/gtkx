import type * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwExpanderRow,
    AdwHeaderBar,
    AdwToolbarView,
    GtkButton,
    GtkHeaderBar,
    GtkLabel,
    GtkListBox,
} from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createElement, createRef } from "react";
import { describe, expect, it } from "vitest";
import { countChildren } from "../helpers/child-count.js";

describe("render - ContainerSlot (1)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (1)", () => {
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
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const suffixRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddPrefix>
                            <GtkLabel ref={prefixRef} label="First" />
                        </AdwActionRow.AddPrefix>
                        <AdwActionRow.AddSuffix>
                            <GtkLabel ref={suffixRef} label="Second" />
                        </AdwActionRow.AddSuffix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(rowRef.current).not.toBeNull();
            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (2)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (2)", () => {
        it("removes prefix and suffix children", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const labelRefs = [createRef<Gtk.Label>(), createRef<Gtk.Label>(), createRef<Gtk.Label>()];

            function App({ count }: { count: number }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            {Array.from({ length: count }, (_, i) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: Test fixture with stable items
                                <AdwActionRow.AddSuffix key={`suffix-label-${i}`}>
                                    <GtkLabel ref={labelRefs[i]} label={`Label ${i}`} />
                                </AdwActionRow.AddSuffix>
                            ))}
                        </AdwActionRow>
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

        it("adds child as prefix via addPrefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddPrefix>
                            <GtkLabel ref={prefixRef} label="Prefix" />
                        </AdwActionRow.AddPrefix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(prefixRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (3)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (3)", () => {
        it("adds child as suffix via addSuffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const suffixRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddSuffix>
                            <GtkLabel ref={suffixRef} label="Suffix" />
                        </AdwActionRow.AddSuffix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(suffixRef.current).not.toBeNull();
        });

        it("combines addPrefix and addSuffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const suffixRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddPrefix>
                            <GtkLabel ref={prefixRef} label="Prefix" />
                        </AdwActionRow.AddPrefix>
                        <AdwActionRow.AddSuffix>
                            <GtkLabel ref={suffixRef} label="Suffix" />
                        </AdwActionRow.AddSuffix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (4)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (4)", () => {
        it("removes prefix child", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ showPrefix }: { showPrefix: boolean }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            {showPrefix && (
                                <AdwActionRow.AddPrefix>
                                    <GtkLabel ref={prefixRef} label="Prefix" />
                                </AdwActionRow.AddPrefix>
                            )}
                            <AdwActionRow.AddSuffix>
                                <GtkLabel ref={alwaysRef} label="Always" />
                            </AdwActionRow.AddSuffix>
                        </AdwActionRow>
                    </GtkListBox>
                );
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

describe("render - ContainerSlot (5)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (5)", () => {
        it("adds multiple children as prefix via addPrefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddPrefix>
                            <GtkLabel ref={firstRef} label="First" />
                            <GtkLabel ref={secondRef} label="Second" />
                        </AdwActionRow.AddPrefix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("adds multiple children as suffix via addSuffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <AdwActionRow.AddSuffix>
                            <GtkLabel ref={firstRef} label="First" />
                            <GtkLabel ref={secondRef} label="Second" />
                        </AdwActionRow.AddSuffix>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (6)", () => {
    describe("AdwActionRow (addPrefix/addSuffix) (6)", () => {
        it("removes individual children from addPrefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            function App({ showSecond }: { showSecond: boolean }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            <AdwActionRow.AddPrefix>
                                <GtkLabel ref={firstRef} label="First" />
                                {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                            </AdwActionRow.AddPrefix>
                        </AdwActionRow>
                    </GtkListBox>
                );
            }

            const { rerender } = await render(<App showSecond={true} />);

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();

            await rerender(<App showSecond={false} />);

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).toBeNull();
        });
    });
});

describe("render - ContainerSlot (7)", () => {
    describe("AdwExpanderRow (rows/actions) (1)", () => {
        it("creates ExpanderRow widget", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(<AdwExpanderRow ref={ref} title="Test" />);

            expect(ref.current).not.toBeNull();
            expect(ref.current?.getTitle()).toBe("Test");
        });

        it("updates title when prop changes", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            function App({ title }: { title: string }) {
                return <AdwExpanderRow ref={ref} title={title} />;
            }

            await render(<App title="Initial" />);
            expect(ref.current?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            expect(ref.current?.getTitle()).toBe("Updated");
        });

        it("adds prefix and suffix widgets via compound components", async () => {
            const prefixRef = createRef<Gtk.Button>();
            const suffixRef = createRef<Gtk.Button>();

            await render(
                <AdwExpanderRow title="Row">
                    <AdwExpanderRow.AddPrefix>
                        <GtkButton ref={prefixRef} label="Prefix" />
                    </AdwExpanderRow.AddPrefix>
                    <AdwExpanderRow.AddSuffix>
                        <GtkButton ref={suffixRef} label="Suffix" />
                    </AdwExpanderRow.AddSuffix>
                </AdwExpanderRow>,
            );

            expect(prefixRef.current?.getLabel()).toBe("Prefix");
            expect(suffixRef.current?.getLabel()).toBe("Suffix");
        });
    });
});

describe("render - ContainerSlot (8)", () => {
    describe("AdwExpanderRow (rows/actions) (2)", () => {
        it("adds nested rows to ExpanderRow", async () => {
            const rowRef = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow title="Settings">
                    <AdwExpanderRow.AddRow>
                        <AdwActionRow ref={rowRef} title="Option 1" />
                    </AdwExpanderRow.AddRow>
                </AdwExpanderRow>,
            );

            expect(rowRef.current).not.toBeNull();
            expect(rowRef.current?.getTitle()).toBe("Option 1");
        });

        it("adds multiple rows", async () => {
            const row1Ref = createRef<Adw.ActionRow>();
            const row2Ref = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow title="Settings">
                    <AdwExpanderRow.AddRow>
                        <AdwActionRow ref={row1Ref} title="Option 1" />
                        <AdwActionRow ref={row2Ref} title="Option 2" />
                    </AdwExpanderRow.AddRow>
                </AdwExpanderRow>,
            );

            expect(row1Ref.current?.getTitle()).toBe("Option 1");
            expect(row2Ref.current?.getTitle()).toBe("Option 2");
        });
    });
});

describe("render - ContainerSlot (9)", () => {
    describe("AdwExpanderRow (rows/actions) (3)", () => {
        it("removes nested rows when unmounted", async () => {
            const expanderRef = createRef<Adw.ExpanderRow>();

            function App({ showRow }: { showRow: boolean }) {
                return (
                    <AdwExpanderRow ref={expanderRef} title="Settings">
                        <AdwExpanderRow.AddRow>
                            <AdwActionRow title="Always" />
                            {showRow && <AdwActionRow title="Conditional" />}
                        </AdwExpanderRow.AddRow>
                    </AdwExpanderRow>
                );
            }

            await render(<App showRow={true} />);
            expect(expanderRef.current).not.toBeNull();

            await render(<App showRow={false} />);
            expect(expanderRef.current).not.toBeNull();
        });

        it("adds action widgets to ExpanderRow", async () => {
            const actionRef = createRef<Gtk.Button>();

            await render(
                <AdwExpanderRow title="Group">
                    <AdwExpanderRow.AddAction>
                        <GtkButton ref={actionRef} label="Action" />
                    </AdwExpanderRow.AddAction>
                </AdwExpanderRow>,
            );

            expect(actionRef.current?.getLabel()).toBe("Action");
        });
    });
});

describe("render - ContainerSlot (10)", () => {
    describe("AdwExpanderRow (rows/actions) (4)", () => {
        it("adds multiple action widgets", async () => {
            const action1Ref = createRef<Gtk.Button>();
            const action2Ref = createRef<Gtk.Button>();

            await render(
                <AdwExpanderRow title="Group">
                    <AdwExpanderRow.AddAction>
                        <GtkButton ref={action1Ref} label="Action 1" />
                        <GtkButton ref={action2Ref} label="Action 2" />
                    </AdwExpanderRow.AddAction>
                </AdwExpanderRow>,
            );

            expect(action1Ref.current?.getLabel()).toBe("Action 1");
            expect(action2Ref.current?.getLabel()).toBe("Action 2");
        });

        it("handles multiple rows and actions together", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(
                <AdwExpanderRow ref={ref} title="Complex">
                    <AdwExpanderRow.AddAction>
                        <GtkButton label="Action 1" />
                        <GtkButton label="Action 2" />
                    </AdwExpanderRow.AddAction>
                    <AdwExpanderRow.AddRow>
                        <AdwActionRow title="Row 1" />
                        <AdwActionRow title="Row 2" />
                        <AdwActionRow title="Row 3" />
                    </AdwExpanderRow.AddRow>
                </AdwExpanderRow>,
            );

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (11)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (1)", () => {
        it("packs child at start via packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkHeaderBar.PackStart>
                        <GtkLabel ref={startRef} label="Start" />
                    </GtkHeaderBar.PackStart>
                </GtkHeaderBar>,
            );

            expect(startRef.current).not.toBeNull();
            expect(startRef.current?.getLabel()).toBe("Start");
        });

        it("packs child at end via packEnd", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const endRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkHeaderBar.PackEnd>
                        <GtkLabel ref={endRef} label="End" />
                    </GtkHeaderBar.PackEnd>
                </GtkHeaderBar>,
            );

            expect(endRef.current).not.toBeNull();
            expect(endRef.current?.getLabel()).toBe("End");
        });
    });
});

describe("render - ContainerSlot (12)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (2)", () => {
        it("combines packStart and packEnd", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const endRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkHeaderBar.PackStart>
                        <GtkLabel ref={startRef} label="Start" />
                    </GtkHeaderBar.PackStart>
                    <GtkHeaderBar.PackEnd>
                        <GtkLabel ref={endRef} label="End" />
                    </GtkHeaderBar.PackEnd>
                </GtkHeaderBar>,
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
                    <GtkHeaderBar ref={headerBarRef} titleWidget={<GtkLabel ref={alwaysRef} label="Always" />}>
                        {showStart && (
                            <GtkHeaderBar.PackStart>
                                <GtkLabel ref={startRef} label="Start" />
                            </GtkHeaderBar.PackStart>
                        )}
                    </GtkHeaderBar>
                );
            }

            await render(<App showStart={true} />);

            expect(startRef.current).not.toBeNull();
            expect(alwaysRef.current).not.toBeNull();

            await render(<App showStart={false} />);

            expect(startRef.current).toBeNull();
            expect(alwaysRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (13)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (3)", () => {
        it("packs multiple children at start via packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkHeaderBar.PackStart>
                        <GtkLabel ref={firstRef} label="First" />
                        <GtkLabel ref={secondRef} label="Second" />
                    </GtkHeaderBar.PackStart>
                </GtkHeaderBar>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("packs multiple children at end via packEnd", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <GtkHeaderBar.PackEnd>
                        <GtkLabel ref={firstRef} label="First" />
                        <GtkLabel ref={secondRef} label="Second" />
                    </GtkHeaderBar.PackEnd>
                </GtkHeaderBar>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (14)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (4)", () => {
        it("swaps keyed children in packStart without duplication", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();

            function App({ showBack }: { showBack: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        <GtkHeaderBar.PackStart>
                            {showBack ? (
                                <GtkButton key="back" label="Back" />
                            ) : (
                                <GtkButton key="search" label="Search" />
                            )}
                            <GtkButton label="Delete" />
                        </GtkHeaderBar.PackStart>
                    </GtkHeaderBar>
                );
            }

            const { rerender } = await render(<App showBack={false} />);

            const initialCount = countChildren(headerBarRef.current);

            await rerender(<App showBack={true} />);

            expect(countChildren(headerBarRef.current)).toBe(initialCount);

            await rerender(<App showBack={false} />);

            expect(countChildren(headerBarRef.current)).toBe(initialCount);
        });
    });
});

describe("render - ContainerSlot (15)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (5)", () => {
        it("reorders children in packStart via insertBefore", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Button>();
            const secondRef = createRef<Gtk.Button>();

            function App({ order }: { order: "ab" | "ba" }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        <GtkHeaderBar.PackStart>
                            {order === "ab" ? (
                                <>
                                    <GtkButton key="a" ref={firstRef} label="A" />
                                    <GtkButton key="b" ref={secondRef} label="B" />
                                </>
                            ) : (
                                <>
                                    <GtkButton key="b" ref={secondRef} label="B" />
                                    <GtkButton key="a" ref={firstRef} label="A" />
                                </>
                            )}
                        </GtkHeaderBar.PackStart>
                    </GtkHeaderBar>
                );
            }

            const { rerender } = await render(<App order="ab" />);

            expect(firstRef.current?.getLabel()).toBe("A");
            expect(secondRef.current?.getLabel()).toBe("B");

            await rerender(<App order="ba" />);

            expect(firstRef.current?.getLabel()).toBe("A");
            expect(secondRef.current?.getLabel()).toBe("B");
        });
    });
});

describe("render - ContainerSlot (16)", () => {
    describe("GtkHeaderBar (packStart/packEnd) (6)", () => {
        it("removes individual children from packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            function App({ showSecond }: { showSecond: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        <GtkHeaderBar.PackStart>
                            <GtkLabel ref={firstRef} label="First" />
                            {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                        </GtkHeaderBar.PackStart>
                    </GtkHeaderBar>
                );
            }

            await render(<App showSecond={true} />);

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();

            await render(<App showSecond={false} />);

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).toBeNull();
        });
    });
});

describe("render - ContainerSlot (17)", () => {
    describe("AdwToolbarView (topBar/bottomBar) (1)", () => {
        it("adds child to top bar via addTopBar", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar />
                    </AdwToolbarView.AddTopBar>
                    <GtkLabel ref={contentRef} label="Content" />
                </AdwToolbarView>,
            );

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });

        it("adds child to bottom bar via addBottomBar", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <GtkLabel ref={contentRef} label="Content" />
                    <AdwToolbarView.AddBottomBar>
                        <AdwHeaderBar />
                    </AdwToolbarView.AddBottomBar>
                </AdwToolbarView>,
            );

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (18)", () => {
    describe("AdwToolbarView (topBar/bottomBar) (2)", () => {
        it("handles multiple top bars", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const secondTopRef = createRef<Gtk.Label>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar />
                    </AdwToolbarView.AddTopBar>
                    <AdwToolbarView.AddTopBar>
                        <GtkLabel ref={secondTopRef} label="Second Top Bar" />
                    </AdwToolbarView.AddTopBar>
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
                    <AdwToolbarView ref={toolbarRef}>
                        {showTop && (
                            <AdwToolbarView.AddTopBar>
                                <AdwHeaderBar />
                            </AdwToolbarView.AddTopBar>
                        )}
                        <GtkLabel ref={contentRef} label="Content" />
                    </AdwToolbarView>
                );
            }

            await render(<App showTop={false} />);
            await render(<App showTop={true} />);

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });
    });
});

describe("render - ContainerSlot (19)", () => {
    describe("error handling", () => {
        it("throws when the requested method does not exist on the parent", async () => {
            await expect(
                render(
                    <GtkListBox>
                        {createElement("ContainerSlot", { id: "thisMethodDoesNotExist" }, <GtkLabel label="orphan" />)}
                    </GtkListBox>,
                ),
            ).rejects.toThrow(/Method 'thisMethodDoesNotExist' not found/);
        });
    });
});
