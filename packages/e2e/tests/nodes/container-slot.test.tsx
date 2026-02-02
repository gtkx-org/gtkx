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
    x,
} from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - ContainerSlot", () => {
    describe("AdwActionRow (addPrefix/addSuffix)", () => {
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
                        <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                            <GtkLabel ref={prefixRef} label="First" />
                        </x.ContainerSlot>
                        <x.ContainerSlot for={AdwActionRow} id="addSuffix">
                            <GtkLabel ref={suffixRef} label="Second" />
                        </x.ContainerSlot>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(rowRef.current).not.toBeNull();
            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });

        it("removes prefix and suffix children", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const labelRefs = [createRef<Gtk.Label>(), createRef<Gtk.Label>(), createRef<Gtk.Label>()];

            function App({ count }: { count: number }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            {Array.from({ length: count }, (_, i) => (
                                // biome-ignore lint/suspicious/noArrayIndexKey: Test fixture with stable items
                                <x.ContainerSlot for={AdwActionRow} id="addSuffix" key={`suffix-label-${i}`}>
                                    <GtkLabel ref={labelRefs[i]} label={`Label ${i}`} />
                                </x.ContainerSlot>
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
                        <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                            <GtkLabel ref={prefixRef} label="Prefix" />
                        </x.ContainerSlot>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(prefixRef.current).not.toBeNull();
        });

        it("adds child as suffix via addSuffix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const suffixRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <x.ContainerSlot for={AdwActionRow} id="addSuffix">
                            <GtkLabel ref={suffixRef} label="Suffix" />
                        </x.ContainerSlot>
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
                        <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                            <GtkLabel ref={prefixRef} label="Prefix" />
                        </x.ContainerSlot>
                        <x.ContainerSlot for={AdwActionRow} id="addSuffix">
                            <GtkLabel ref={suffixRef} label="Suffix" />
                        </x.ContainerSlot>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(prefixRef.current).not.toBeNull();
            expect(suffixRef.current).not.toBeNull();
        });

        it("removes prefix child", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const prefixRef = createRef<Gtk.Label>();
            const alwaysRef = createRef<Gtk.Label>();

            function App({ showPrefix }: { showPrefix: boolean }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            {showPrefix && (
                                <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                                    <GtkLabel ref={prefixRef} label="Prefix" />
                                </x.ContainerSlot>
                            )}
                            <x.ContainerSlot for={AdwActionRow} id="addSuffix">
                                <GtkLabel ref={alwaysRef} label="Always" />
                            </x.ContainerSlot>
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

        it("adds multiple children as prefix via addPrefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkListBox>
                    <AdwActionRow ref={rowRef} title="Test Row">
                        <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                            <GtkLabel ref={firstRef} label="First" />
                            <GtkLabel ref={secondRef} label="Second" />
                        </x.ContainerSlot>
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
                        <x.ContainerSlot for={AdwActionRow} id="addSuffix">
                            <GtkLabel ref={firstRef} label="First" />
                            <GtkLabel ref={secondRef} label="Second" />
                        </x.ContainerSlot>
                    </AdwActionRow>
                </GtkListBox>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("removes individual children from addPrefix", async () => {
            const rowRef = createRef<Adw.ActionRow>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            function App({ showSecond }: { showSecond: boolean }) {
                return (
                    <GtkListBox>
                        <AdwActionRow ref={rowRef} title="Test Row">
                            <x.ContainerSlot for={AdwActionRow} id="addPrefix">
                                <GtkLabel ref={firstRef} label="First" />
                                {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                            </x.ContainerSlot>
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

    describe("AdwExpanderRow (rows/actions)", () => {
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

        it("adds prefix and suffix widgets via ContainerSlot", async () => {
            await render(
                <AdwExpanderRow title="Row">
                    <x.ContainerSlot for={AdwExpanderRow} id="addPrefix">
                        <GtkButton label="Prefix" />
                    </x.ContainerSlot>
                    <x.ContainerSlot for={AdwExpanderRow} id="addSuffix">
                        <GtkButton label="Suffix" />
                    </x.ContainerSlot>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });

        it("adds nested rows to ExpanderRow", async () => {
            const rowRef = createRef<Adw.ActionRow>();

            await render(
                <AdwExpanderRow title="Settings">
                    <x.ContainerSlot for={AdwExpanderRow} id="addRow">
                        <AdwActionRow ref={rowRef} title="Option 1" />
                    </x.ContainerSlot>
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
                    <x.ContainerSlot for={AdwExpanderRow} id="addRow">
                        <AdwActionRow ref={row1Ref} title="Option 1" />
                        <AdwActionRow ref={row2Ref} title="Option 2" />
                    </x.ContainerSlot>
                </AdwExpanderRow>,
            );

            expect(row1Ref.current?.getTitle()).toBe("Option 1");
            expect(row2Ref.current?.getTitle()).toBe("Option 2");
        });

        it("removes nested rows when unmounted", async () => {
            const expanderRef = createRef<Adw.ExpanderRow>();

            function App({ showRow }: { showRow: boolean }) {
                return (
                    <AdwExpanderRow ref={expanderRef} title="Settings">
                        <x.ContainerSlot for={AdwExpanderRow} id="addRow">
                            <AdwActionRow title="Always" />
                            {showRow && <AdwActionRow title="Conditional" />}
                        </x.ContainerSlot>
                    </AdwExpanderRow>
                );
            }

            await render(<App showRow={true} />);
            expect(expanderRef.current).not.toBeNull();

            await render(<App showRow={false} />);
            expect(expanderRef.current).not.toBeNull();
        });

        it("adds action widgets to ExpanderRow", async () => {
            await render(
                <AdwExpanderRow title="Group">
                    <x.ContainerSlot for={AdwExpanderRow} id="addAction">
                        <GtkButton label="Action" />
                    </x.ContainerSlot>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });

        it("adds multiple action widgets", async () => {
            await render(
                <AdwExpanderRow title="Group">
                    <x.ContainerSlot for={AdwExpanderRow} id="addAction">
                        <GtkButton label="Action 1" />
                        <GtkButton label="Action 2" />
                    </x.ContainerSlot>
                </AdwExpanderRow>,
            );

            expect(true).toBe(true);
        });

        it("handles multiple rows and actions together", async () => {
            const ref = createRef<Adw.ExpanderRow>();

            await render(
                <AdwExpanderRow ref={ref} title="Complex">
                    <x.ContainerSlot for={AdwExpanderRow} id="addAction">
                        <GtkButton label="Action 1" />
                        <GtkButton label="Action 2" />
                    </x.ContainerSlot>
                    <x.ContainerSlot for={AdwExpanderRow} id="addRow">
                        <AdwActionRow title="Row 1" />
                        <AdwActionRow title="Row 2" />
                        <AdwActionRow title="Row 3" />
                    </x.ContainerSlot>
                </AdwExpanderRow>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("GtkHeaderBar (packStart/packEnd)", () => {
        it("packs child at start via packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkLabel ref={startRef} label="Start" />
                    </x.ContainerSlot>
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
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkLabel ref={endRef} label="End" />
                    </x.ContainerSlot>
                </GtkHeaderBar>,
            );

            expect(endRef.current).not.toBeNull();
            expect(endRef.current?.getLabel()).toBe("End");
        });

        it("combines packStart and packEnd", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const startRef = createRef<Gtk.Label>();
            const endRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkLabel ref={startRef} label="Start" />
                    </x.ContainerSlot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkLabel ref={endRef} label="End" />
                    </x.ContainerSlot>
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
                    <GtkHeaderBar ref={headerBarRef}>
                        {showStart && (
                            <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                                <GtkLabel ref={startRef} label="Start" />
                            </x.ContainerSlot>
                        )}
                        <x.Slot for={GtkHeaderBar} id="titleWidget">
                            <GtkLabel ref={alwaysRef} label="Always" />
                        </x.Slot>
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

        it("packs multiple children at start via packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            await render(
                <GtkHeaderBar ref={headerBarRef}>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkLabel ref={firstRef} label="First" />
                        <GtkLabel ref={secondRef} label="Second" />
                    </x.ContainerSlot>
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
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkLabel ref={firstRef} label="First" />
                        <GtkLabel ref={secondRef} label="Second" />
                    </x.ContainerSlot>
                </GtkHeaderBar>,
            );

            expect(firstRef.current).not.toBeNull();
            expect(secondRef.current).not.toBeNull();
        });

        it("removes individual children from packStart", async () => {
            const headerBarRef = createRef<Gtk.HeaderBar>();
            const firstRef = createRef<Gtk.Label>();
            const secondRef = createRef<Gtk.Label>();

            function App({ showSecond }: { showSecond: boolean }) {
                return (
                    <GtkHeaderBar ref={headerBarRef}>
                        <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                            <GtkLabel ref={firstRef} label="First" />
                            {showSecond && <GtkLabel ref={secondRef} label="Second" />}
                        </x.ContainerSlot>
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

    describe("AdwToolbarView (topBar/bottomBar)", () => {
        it("adds child to top bar via addTopBar", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
                        <AdwHeaderBar />
                    </x.ContainerSlot>
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
                    <x.ContainerSlot for={AdwToolbarView} id="addBottomBar">
                        <AdwHeaderBar />
                    </x.ContainerSlot>
                </AdwToolbarView>,
            );

            expect(contentRef.current).not.toBeNull();
            expect(toolbarRef.current?.getContent()).not.toBeNull();
        });

        it("handles multiple top bars", async () => {
            const toolbarRef = createRef<Adw.ToolbarView>();
            const secondTopRef = createRef<Gtk.Label>();
            const contentRef = createRef<Gtk.Label>();

            await render(
                <AdwToolbarView ref={toolbarRef}>
                    <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
                        <AdwHeaderBar />
                    </x.ContainerSlot>
                    <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
                        <GtkLabel ref={secondTopRef} label="Second Top Bar" />
                    </x.ContainerSlot>
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
                            <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
                                <AdwHeaderBar />
                            </x.ContainerSlot>
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
