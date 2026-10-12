import { createTabCollection, type TabCollection } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import { AdwTabOverview, AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GtkBox, GtkEntry } from "@gtkx/jsx/gtk";
import * as Gtk from "@gtkx/gi/gtk";
import { act, render, screen, userEvent } from "@gtkx/testing";
import { createRef, useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

type Item = { title: string; pinned?: boolean };
const collections: TabCollection<Item>[] = [];
const collection = () => {
    const tabs = createTabCollection<Item>({
        pageProps: (item) => ({ ...item, children: <GtkEntry text={item.title} /> }),
    });
    collections.push(tabs);
    return tabs;
};

afterEach(async () => {
    await act(() => {
        for (const tabs of collections.splice(0)) tabs.dispose();
    });
});

describe("tab collection", () => {
    it("updates its managed page through the page getter in entry events", async () => {
        const sourceRef = createRef<Adw.TabView>();
        const targetRef = createRef<Adw.TabView>();
        const tabs = createTabCollection<Item>({
            pageProps: (item, getPage) => ({
                title: item.title,
                children: (
                    <GtkEntry
                        text={item.title}
                        onChanged={(entry) => {
                            const page = getPage();
                            if (page === null) throw new Error("Expected the event's adopted page");
                            tabs.update(page, { ...item, title: entry.getText() });
                        }}
                    />
                ),
            }),
        });
        collections.push(tabs);
        await render(
            <GtkBox>
                <AdwTabView ref={sourceRef} />
                <AdwTabView ref={targetRef} />
            </GtkBox>,
        );
        const source = sourceRef.current;
        const target = targetRef.current;
        if (source === null || target === null) throw new Error("Expected both views");
        await act(() => {
            tabs.append(source, { title: "Original" });
        });
        const page = source.getNthPage(0);
        const entry = screen.getByDisplayValue("Original");
        await userEvent.clear(entry);
        await userEvent.type(entry, "Edited");
        expect(page.getTitle()).toBe("Edited");
        expect(tabs.get(page)).toEqual({ title: "Edited" });
        await act(() => tabs.transfer(page, target));
        await userEvent.clear(entry);
        await userEvent.type(entry, "Arrived");
        expect(target.getNthPage(0)).toBe(page);
        expect(page.getTitle()).toBe("Arrived");
        expect(tabs.get(page)).toEqual({ title: "Arrived" });
        expect(screen.getByDisplayValue("Arrived")).toBe(entry);
    });

    it("returns pages synchronously and appends within each pin group", async () => {
        const ref = createRef<Adw.TabView>();
        await render(<AdwTabView ref={ref} />);
        const view = ref.current;
        if (view === null) throw new Error("Expected a tab view");
        const tabs = collection();
        const pages: Adw.TabPage[] = [];
        await act(() => {
            pages.push(tabs.append(view, { title: "First" }));
            pages.push(tabs.append(view, { title: "Pinned", pinned: true }, { select: false }));
            pages.push(tabs.append(view, { title: "Last" }, { select: false }));
        });
        expect(view.getNPages()).toBe(3);
        expect(view.getNPinnedPages()).toBe(1);
        expect(view.getNthPage(0)).toBe(pages[1]);
        expect(view.getNthPage(1)).toBe(pages[0]);
        expect(view.getNthPage(2)).toBe(pages[2]);
        expect(view.getSelectedPage()).toBe(pages[0]);
        const parent = view.getNthPage(1);
        await act(() => {
            tabs.append(view, { title: "Related" }, { parent });
        });
        const related = view.getSelectedPage();
        if (related === null) throw new Error("Expected the related page");
        expect(related.getParent()).toBe(parent);
        expect(view.getNthPage(2)).toBe(related);
        await act(() => tabs.remove(related));
        expect(view.getSelectedPage()).toBe(parent);
        expect(tabs.get(related)).toBeUndefined();
    });

    it("preserves component state and native identity after transfer and source unmount", async () => {
        const sourceRef = createRef<Adw.TabView>();
        const targetRef = createRef<Adw.TabView>();
        const Views = ({ source }: { source: boolean }) => (
            <GtkBox>
                {source && <AdwTabView ref={sourceRef} />}
                <AdwTabView ref={targetRef} />
            </GtkBox>
        );
        const Editor = () => {
            const [text, setText] = useState("Original");
            return <GtkEntry text={text} onChanged={(entry) => setText(entry.getText())} />;
        };
        const tabs = createTabCollection<Item>({ pageProps: (item) => ({ ...item, children: <Editor /> }) });
        collections.push(tabs);
        const { rerender } = await render(<Views source />);
        const source = sourceRef.current;
        const target = targetRef.current;
        if (source === null || target === null) throw new Error("Expected both views");
        await act(() => {
            tabs.append(source, { title: "Moving" });
        });
        const page = source.getNthPage(0);
        const entry = screen.getByDisplayValue("Original");
        await userEvent.clear(entry);
        await userEvent.type(entry, "Edited");
        await act(() => tabs.transfer(page, target));
        await act(() => tabs.removeView(source));
        await rerender(<Views source={false} />);
        await act(() => tabs.update(page, { title: "Arrived", pinned: true }));
        expect(target.getNthPage(0)).toBe(page);
        expect(page.getTitle()).toBe("Arrived");
        expect(page.getPinned()).toBe(true);
        expect(screen.getByDisplayValue("Edited")).toBe(entry);
        await userEvent.clear(entry);
        await userEvent.type(entry, "Again");
        expect(screen.getByDisplayValue("Again")).toBe(entry);
        await act(() => tabs.removeView(target));
        expect(target.getNPages()).toBe(0);
        expect(tabs.get(page)).toBeUndefined();
    });

    it("handles native transfers, accepted closes, and repeated disposal", async () => {
        const sourceRef = createRef<Adw.TabView>();
        const targetRef = createRef<Adw.TabView>();
        let mounted = 0;
        let cleaned = 0;
        const Content = () => {
            useEffect(() => {
                mounted += 1;
                return () => {
                    cleaned += 1;
                };
            }, []);
            return <GtkEntry text="Tracked" />;
        };
        const tabs = createTabCollection<Item>({ pageProps: (item) => ({ ...item, children: <Content /> }) });
        collections.push(tabs);
        await render(
            <GtkBox>
                <AdwTabView ref={sourceRef} />
                <AdwTabView
                    ref={targetRef}
                    onClosePage={(page, view) => {
                        view.closePageFinish(page, true);
                        tabs.remove(page);
                        return true;
                    }}
                />
            </GtkBox>,
        );
        const source = sourceRef.current;
        const target = targetRef.current;
        if (source === null || target === null) throw new Error("Expected both views");
        await act(() => {
            tabs.append(source, { title: "Moving" });
            tabs.append(source, { title: "Staying" });
        });
        const page = source.getNthPage(0);
        await act(() => source.transferPage(page, target, 0));
        await act(() => tabs.removeView(source));
        expect(target.getNPages()).toBe(1);
        await act(() => target.closePage(page));
        expect(tabs.get(page)).toBeUndefined();
        expect(target.getNPages()).toBe(0);
        await act(() => {
            tabs.remove(page);
            tabs.dispose();
            tabs.dispose();
        });
        await act(() => {
            tabs.append(target, { title: "Reusable" });
        });
        expect(target.getNPages()).toBe(1);
        await act(() => tabs.dispose());
        expect(mounted).toBe(3);
        expect(cleaned).toBe(3);
    });

    it("enforces native pin boundaries when transferring and reordering", async () => {
        const sourceRef = createRef<Adw.TabView>();
        const targetRef = createRef<Adw.TabView>();
        await render(
            <GtkBox>
                <AdwTabView ref={sourceRef} />
                <AdwTabView ref={targetRef} />
            </GtkBox>,
        );
        const source = sourceRef.current;
        const target = targetRef.current;
        if (source === null || target === null) throw new Error("Expected both views");
        const tabs = collection();
        await act(() => {
            tabs.append(source, { title: "Pinned source", pinned: true });
            tabs.append(source, { title: "Source" });
            tabs.append(target, { title: "Pinned target", pinned: true });
            tabs.append(target, { title: "Target" });
        });
        const pinned = source.getNthPage(0);
        const unpinned = source.getNthPage(1);
        expect(() => tabs.transfer(pinned, target, 2)).toThrow(RangeError);
        expect(() => tabs.transfer(unpinned, target, 0)).toThrow(RangeError);
        expect(() => tabs.append(target, { title: "Invalid parent" }, { parent: pinned })).toThrow(RangeError);
        expect(target.getNPages()).toBe(2);
        expect(source.getNPages()).toBe(2);
        await act(() => {
            tabs.transfer(pinned, target);
            tabs.transfer(unpinned, target);
        });
        expect(target.getNthPage(1)).toBe(pinned);
        expect(target.getNthPage(3)).toBe(unpinned);
        await act(() => tabs.transfer(pinned, target, 0));
        expect(target.getNthPage(0)).toBe(pinned);
        await act(() => tabs.update(pinned, { title: "Unpinned", pinned: false }));
        expect(target.getNPinnedPages()).toBe(1);
    });

    it("creates a managed page through the real overview new-tab button", async () => {
        const tabs = collection();
        const App = () => {
            const [view, setView] = useState<Adw.TabView | null>(null);
            return (
                <AdwTabOverview
                    view={view ?? undefined}
                    open={view !== null}
                    enableNewTab
                    onCreateTab={() => (view ? tabs.append(view, { title: "Created" }) : undefined)}
                >
                    <AdwTabView ref={setView}>
                        <AdwTabPage title="Existing">
                            <GtkEntry text="Existing" />
                        </AdwTabPage>
                    </AdwTabView>
                </AdwTabOverview>
            );
        };
        await render(<App />);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "New Tab" }));
        expect(await screen.findByDisplayValue("Created")).toBeRooted();
    });
});
