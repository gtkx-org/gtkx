import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwTabOverview, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry } from "@gtkx/jsx/gtk";
import { createRoot, flushSync } from "@gtkx/react";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

describe("native tab lifecycle", () => {
    it("returns a JSX page synchronously from the overview create-tab signal", async () => {
        const overview = createRef<Adw.TabOverview>();
        const view = createRef<Adw.TabView>();
        const page = createRef<Adw.TabPage>();
        const returned = { page: null as Adw.TabPage | null };
        const App = () => {
            const [created, setCreated] = useState(false);
            const [viewInstance, setViewInstance] = useState<Adw.TabView | null>(null);

            return (
                <GtkBox>
                    <AdwTabOverview
                        ref={overview}
                        view={viewInstance ?? undefined}
                        open={viewInstance !== null}
                        enableNewTab
                        onCreateTab={() => {
                            flushSync(() => setCreated(true));
                            returned.page = page.current;
                            return page.current ?? undefined;
                        }}
                    >
                        <AdwTabView
                            ref={(instance) => {
                                view.current = instance;
                                setViewInstance(instance);
                            }}
                        >
                            <AdwTabPage title="Existing">
                                <GtkEntry text="Existing" />
                            </AdwTabPage>
                            {created && (
                                <AdwTabPage ref={page} title="Created">
                                    <GtkEntry text="New tab" />
                                </AdwTabPage>
                            )}
                        </AdwTabView>
                    </AdwTabOverview>
                </GtkBox>
            );
        };

        await render(<App />);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Tab" }));
        expect(returned.page).not.toBeNull();
        expect(returned.page).toBe(view.current?.getNthPage(1));
        expect(view.current?.getNthPage(1).getChild()).toHaveObjectProperty("text", "New tab");
    });

    it("removes a page from its actual view after a native transfer", async () => {
        const source = createRef<Adw.TabView>();
        const target = createRef<Adw.TabView>();
        const page = createRef<Adw.TabPage>();
        const App = ({ visible }: { visible: boolean }) => (
            <GtkBox>
                <AdwTabView ref={source}>
                    {visible && (
                        <AdwTabPage ref={page} title="Transferred">
                            <GtkEntry text="Persisted text" />
                        </AdwTabPage>
                    )}
                </AdwTabView>
                <AdwTabView ref={target} />
            </GtkBox>
        );

        const { rerender } = await render(<App visible />);
        await act(() => {
            if (source.current && target.current && page.current) {
                source.current.transferPage(page.current, target.current, 0);
            }
        });
        expect(target.current?.getNPages()).toBe(1);
        await userEvent.clear(screen.getByDisplayValue("Persisted text"));
        await userEvent.type(screen.getByDisplayValue(""), "Edited text");
        expect(screen.getByDisplayValue("Edited text")).toBeRooted();
        await rerender(<App visible={false} />);
        expect(target.current?.getNPages()).toBe(0);
    });

    it("preserves an independently rendered tab when its source view unmounts", async () => {
        const source = createRef<Adw.TabView>();
        const target = createRef<Adw.TabView>();
        const page = createRef<Adw.TabPage>();
        const App = ({ showSource }: { showSource: boolean }) => (
            <GtkBox>
                {showSource && <AdwTabView ref={source} />}
                <AdwTabView ref={target} />
            </GtkBox>
        );
        const Tab = () => {
            const [text, setText] = useState("Original");
            return (
                <AdwTabPage ref={page} title={text}>
                    <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} />
                </AdwTabPage>
            );
        };
        const { rerender } = await render(<App showSource />);
        const view = source.current;

        if (view === null) {
            throw new Error("Expected a source view");
        }

        const root = createRoot(view);
        await act(() => root.render(<Tab />));
        const original = page.current;
        const entry = screen.getByDisplayValue("Original");
        await userEvent.clear(entry);
        await userEvent.type(entry, "Edited");

        await act(() => {
            if (page.current && target.current) {
                view.transferPage(page.current, target.current, 0);
            }
        });
        await rerender(<App showSource={false} />);
        expect(page.current).toBe(original);
        expect(target.current?.getNthPage(0)).toBe(original);
        expect(screen.getByDisplayValue("Edited")).toBe(entry);
        await userEvent.clear(entry);
        await userEvent.type(entry, "Again");
        expect(page.current?.getTitle()).toBe("Again");
        await act(() => root.unmount());
        expect(target.current?.getNPages()).toBe(0);
    });

    it("removes a pinned tab when its JSX is removed", async () => {
        const view = createRef<Adw.TabView>();
        const page = createRef<Adw.TabPage>();
        const App = ({ visible }: { visible: boolean }) => (
            <AdwTabView ref={view}>
                {visible && (
                    <AdwTabPage ref={page} title="Pinned">
                        <GtkEntry text="Pinned content" />
                    </AdwTabPage>
                )}
            </AdwTabView>
        );
        const { rerender } = await render(<App visible />);
        await act(() => {
            if (view.current && page.current) {
                view.current.setPagePinned(page.current, true);
            }
        });
        await rerender(<App visible={false} />);
        expect(view.current?.getNPages()).toBe(0);
    });

    it("selects the parent of an independently rendered duplicate after closing it", async () => {
        const view = createRef<Adw.TabView>();
        const parent = createRef<Adw.TabPage>();
        const duplicate = createRef<Adw.TabPage>();
        await render(
            <AdwTabView ref={view}>
                <AdwTabPage ref={parent} title="Parent">
                    <GtkEntry text="Original" />
                </AdwTabPage>
                <AdwTabPage title="Unrelated">
                    <GtkEntry text="Unrelated" />
                </AdwTabPage>
            </AdwTabView>,
        );
        const nativeView = view.current;
        const parentPage = parent.current;
        if (nativeView === null || parentPage === null) {
            throw new Error("Expected an existing tab view and parent page");
        }
        const root = createRoot(nativeView);
        await act(() =>
            root.render(
                <AdwTabPage ref={duplicate} parent={parentPage} title="Duplicate">
                    <GtkEntry text="Copy" />
                </AdwTabPage>,
            ),
        );
        expect(nativeView.getNthPage(1)).toBe(duplicate.current);
        await act(() => {
            if (duplicate.current) nativeView.setSelectedPage(duplicate.current);
        });
        await act(() => root.unmount());
        expect(nativeView.getSelectedPage()).toBe(parentPage);
        expect(nativeView.getNPages()).toBe(2);
    });

    it("returns a newly rendered view synchronously for native window creation", async () => {
        const source = createRef<Adw.TabView>();
        const target = createRef<Adw.TabView>();
        const App = () => {
            const [created, setCreated] = useState(false);
            return (
                <GtkBox>
                    <AdwTabView
                        ref={source}
                        onCreateWindow={() => {
                            flushSync(() => setCreated(true));
                            return target.current;
                        }}
                    />
                    {created && (
                        <AdwTabView ref={target}>
                            <AdwTabPage title="New window">
                                <GtkEntry text="New window" />
                            </AdwTabPage>
                        </AdwTabView>
                    )}
                </GtkBox>
            );
        };
        await render(<App />);
        let result: Adw.TabView | null = null;
        await act(() => {
            result = source.current?.emit("create-window") ?? null;
        });
        expect(result).not.toBeNull();
        expect(result).toBe(target.current);
        expect(screen.getByDisplayValue("New window")).toBeRooted();
    });

    it("reorders JSX tabs within pin groups while retaining a transferred tab's position", async () => {
        const view = createRef<Adw.TabView>();
        const other = createRef<Adw.TabView>();
        const foreign = createRef<Adw.TabPage>();
        const pages = new Map(["A", "B", "C"].map((id) => [id, createRef<Adw.TabPage>()]));
        const app = (order: string[]) => (
            <GtkBox>
                <AdwTabView ref={view}>
                    {order.map((id) => (
                        <AdwTabPage key={id} ref={pages.get(id)} title={id}>
                            <GtkEntry text={id} />
                        </AdwTabPage>
                    ))}
                </AdwTabView>
                <AdwTabView ref={other}>
                    <AdwTabPage ref={foreign} title="Foreign">
                        <GtkEntry text="Foreign" />
                    </AdwTabPage>
                </AdwTabView>
            </GtkBox>
        );
        const { rerender } = await render(app(["A", "B", "C"]));
        const nativeView = view.current;
        const nativeOther = other.current;
        const pinned = pages.get("B")?.current;
        const foreignPage = foreign.current;
        if (!nativeView || !nativeOther || !pinned || !foreignPage) throw new Error("Expected tab views and pages");
        await act(() => {
            nativeView.setPagePinned(pinned, true);
            nativeOther.transferPage(foreignPage, nativeView, 2);
        });
        await rerender(app(["C", "A", "B"]));
        expect(
            Array.from({ length: nativeView.getNPages() }, (_, index) => nativeView.getNthPage(index).getTitle()),
        ).toEqual(["B", "C", "Foreign", "A"]);
        expect(nativeView.getNthPage(0)).toBe(pinned);
        expect(nativeView.getNthPage(2)).toBe(foreignPage);
        await rerender(app(["A", "B", "C"]));
        expect(
            Array.from({ length: nativeView.getNPages() }, (_, index) => nativeView.getNthPage(index).getTitle()),
        ).toEqual(["B", "A", "Foreign", "C"]);
        const transferred = pages.get("C")?.current;
        if (!transferred) throw new Error("Expected the transferred tab");
        await act(() => nativeView.transferPage(transferred, nativeOther, 0));
        await rerender(app(["C", "B", "A"]));
        expect(nativeOther.getNthPage(0)).toBe(transferred);
        expect(
            Array.from({ length: nativeView.getNPages() }, (_, index) => nativeView.getNthPage(index).getTitle()),
        ).toEqual(["B", "A", "Foreign"]);
    });

    it("appends JSX tabs after native tabs transferred into an otherwise empty view", async () => {
        const source = createRef<Adw.TabView>();
        const target = createRef<Adw.TabView>();
        const transferred = createRef<Adw.TabPage>();
        const app = (showNew: boolean) => (
            <GtkBox>
                <AdwTabView ref={source}>
                    <AdwTabPage ref={transferred} title="Transferred">
                        <GtkEntry text="Transferred" />
                    </AdwTabPage>
                </AdwTabView>
                <AdwTabView ref={target}>
                    {showNew && (
                        <AdwTabPage title="New">
                            <GtkEntry text="New" />
                        </AdwTabPage>
                    )}
                </AdwTabView>
            </GtkBox>
        );
        const { rerender } = await render(app(false));
        await act(() => {
            if (source.current && target.current && transferred.current)
                source.current.transferPage(transferred.current, target.current, 0);
        });
        await rerender(app(true));
        expect(target.current?.getNthPage(0)).toBe(transferred.current);
        expect(target.current?.getNthPage(1).getTitle()).toBe("New");
    });
});
