import type * as Gio from "@gtkx/gi/gio";
import type * as Gtk from "@gtkx/gi/gtk";
import { GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkBox, GtkFlowBox, GtkGestureClick, GtkLabel, GtkListBox, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";

describe("native attachments when an entire subtree unmounts", () => {
    it.each(["list", "flow"])("retains native %s rows through reorder and unmount", async (kind) => {
        const labelRef = createRef<Gtk.Label>();
        const App = ({ reversed }: { reversed: boolean }) => {
            const children = (reversed ? ["Second", "First"] : ["First", "Second"]).map((text) => (
                <GtkLabel key={text} ref={text === "First" ? labelRef : undefined}>{text}</GtkLabel>
            ));

            return kind === "list" ? <GtkListBox>{children}</GtkListBox> : <GtkFlowBox>{children}</GtkFlowBox>;
        };
        const { rerender, unmount } = await render(<App reversed={false} />);
        const row = labelRef.current?.getParent();

        await rerender(<App reversed />);

        expect(labelRef.current?.getParent()).toBe(row);
        expect(row?.getPrevSibling()).not.toBeNull();

        await unmount();

        expect(row?.getParent()).toBeNull();
    });

    it("detaches retained event controllers from retained widgets", async () => {
        const boxRef = createRef<Gtk.Box>();
        const controllerRef = createRef<Gtk.GestureClick>();
        const { unmount } = await render(
            <GtkBox ref={boxRef} controllers={<GtkGestureClick ref={controllerRef} />} />,
        );
        const box = boxRef.current;
        const controller = controllerRef.current;
        expect(controller?.getWidget()).toBe(box);

        await unmount();

        expect(controller?.getWidget()).toBeNull();
    });

    it("removes actions from a retained action group", async () => {
        const groupRef = createRef<Gio.SimpleActionGroup>();
        const { unmount } = await render(
            <GtkBox actionGroups={(
                <GSimpleActionGroup ref={groupRef} prefix="test" actions={<GSimpleAction name="run" />} />
            )}
            />,
        );
        const group = groupRef.current;
        expect(group?.hasAction("run")).toBe(true);

        await unmount();

        expect(group?.hasAction("run")).toBe(false);
    });
});

describe("adopted native page refs", () => {
    it("assigns the page ref before its parent layout effect", async () => {
        const pageRef = createRef<Gtk.StackPage>();
        const titles: (string | null | undefined)[] = [];
        const App = () => {
            useLayoutEffect(() => {
                titles.push(pageRef.current?.getTitle());
            }, []);

            return (
                <GtkStack>
                    <GtkStackPage ref={pageRef} title="Ready"><GtkLabel>Content</GtkLabel></GtkStackPage>
                </GtkStack>
            );
        };

        await render(<App />);
        expect(titles).toEqual(["Ready"]);
    });

    it("updates callback refs and runs their cleanup when a page child is replaced", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const childRef = createRef<Gtk.Label>();
        const pages: Gtk.StackPage[] = [];
        const titles: (string | null)[] = [];
        const cleaned: Gtk.StackPage[] = [];
        const ref = (page: Gtk.StackPage | null) => {
            if (page === null) {
                return;
            }

            pages.push(page);
            titles.push(page.getTitle());

            return () => {
                cleaned.push(page);
            };
        };
        const App = ({ version }: { version: string | null }) => (
            <GtkStack ref={stackRef}>
                <GtkStackPage ref={ref} name="page" title={version ?? "Empty"}>
                    {version !== null && <GtkLabel key={version} ref={childRef}>{version}</GtkLabel>}
                </GtkStackPage>
            </GtkStack>
        );
        const { rerender, unmount } = await render(<App version="first" />);
        expect(pages).toHaveLength(1);
        expect(cleaned).toHaveLength(0);
        await rerender(<App version="second" />);
        const child = childRef.current;

        if (child === null) {
            throw new Error("The replacement page child was not mounted");
        }

        expect(pages).toHaveLength(2);
        expect(titles).toEqual(["first", "second"]);
        expect(pages.at(-1)).toBe(stackRef.current?.getPage(child));
        expect(cleaned).toEqual([pages[0]]);
        await rerender(<App version={null} />);
        expect(cleaned).toEqual(pages);
        await unmount();
        expect(cleaned).toEqual(pages);
    });

    it("keeps props updated while a page has no child", async () => {
        const pageRef = createRef<Gtk.StackPage>();
        const App = ({ hasChild, title }: { hasChild: boolean; title: string }) => (
            <GtkStack>
                <GtkStackPage ref={pageRef} title={title}>
                    {hasChild && <GtkLabel>Content</GtkLabel>}
                </GtkStackPage>
            </GtkStack>
        );
        const { rerender } = await render(<App hasChild={false} title="Before" />);
        await rerender(<App hasChild={false} title="After" />);
        expect(pageRef.current).toBeNull();
        await rerender(<App hasChild={true} title="After" />);
        expect(pageRef.current?.getTitle()).toBe("After");
    });

    it("keeps a stable ref synchronized when another keyed page is inserted", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const pageRef = createRef<Gtk.StackPage>();
        const childRef = createRef<Gtk.Label>();
        const App = ({ hasFirst }: { hasFirst: boolean }) => (
            <GtkStack ref={stackRef}>
                {hasFirst && <GtkStackPage key="first" name="first"><GtkLabel>First</GtkLabel></GtkStackPage>}
                <GtkStackPage key="last" ref={pageRef} name="last">
                    <GtkLabel ref={childRef}>Last</GtkLabel>
                </GtkStackPage>
            </GtkStack>
        );
        const { rerender } = await render(<App hasFirst={false} />);
        const child = childRef.current;

        if (child === null) {
            throw new Error("The page child was not mounted");
        }

        expect(pageRef.current).toBe(stackRef.current?.getPage(child));
        await rerender(<App hasFirst={true} />);
        expect(childRef.current).toBe(child);
        expect(pageRef.current).toBe(stackRef.current?.getPage(child));
    });
});
