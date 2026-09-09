import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwViewStack, AdwViewStackPage } from "@gtkx/jsx/adw";
import { GtkAdjustment, GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

type StackRef = RefObject<Adw.ViewStack | null>;
type RootSpec = { key: string; isBoxed: boolean };
type LoadedSpec = { key: string; isLoaded: boolean };

type NotifiedRootProps = {
    stackRef: StackRef;
    isBoxed: boolean;
    onNotifyFirstTitle: (value: string | null) => void;
    onNotifySecondTitle: (value: string | null) => void;
};

const pageNames = (stack: Adw.ViewStack | null): string[] => {
    const pages = stack?.getPages();
    const names: string[] = [];
    const count = pages?.getNItems() ?? 0;

    for (let index = 0; index < count; index += 1) {
        const page = pages?.getItem(index);

        if (page instanceof Adw.ViewStackPage) {
            names.push(page.getName() ?? "");
        }
    }

    return names;
};

const viewPage = (stack: Adw.ViewStack | null, name: string): Adw.ViewStackPage | undefined => {
    const child = stack?.getChildByName(name);

    return child ? stack?.getPage(child) : undefined;
};

const pageRoot = (label: string, isBoxed: boolean): ReactNode => {
    if (isBoxed) {
        return (
            <GtkBox>
                <GtkLabel>{label}</GtkLabel>
            </GtkBox>
        );
    }

    return <GtkLabel>{label}</GtkLabel>;
};

const buildRootPages = (stackRef: StackRef) => (pages: RootSpec[]) => (
    <AdwViewStack ref={stackRef}>
        {pages.map((page) => (
            <AdwViewStackPage key={page.key} name={page.key} title={page.key}>
                {pageRoot(page.key, page.isBoxed)}
            </AdwViewStackPage>
        ))}
    </AdwViewStack>
);

const buildLoadedPages = (stackRef: StackRef) => (pages: LoadedSpec[]) => (
    <AdwViewStack ref={stackRef}>
        {pages.map((page) => (
            <AdwViewStackPage key={page.key} name={page.key} title={page.key}>
                {page.isLoaded ? <GtkLabel>{page.key}</GtkLabel> : null}
            </AdwViewStackPage>
        ))}
    </AdwViewStack>
);

const plain = (keys: string[]): RootSpec[] => keys.map((key) => ({ key, isBoxed: false }));

const boxed = (keys: string[], boxedKeys: string[]): RootSpec[] =>
    keys.map((key) => ({ key, isBoxed: boxedKeys.includes(key) }));

const loaded = (keys: string[], unloadedKeys: string[]): LoadedSpec[] =>
    keys.map((key) => ({ key, isLoaded: !unloadedKeys.includes(key) }));

function NotifiedRoot({ stackRef, isBoxed, onNotifyFirstTitle, onNotifySecondTitle }: NotifiedRootProps) {
    return (
        <AdwViewStack ref={stackRef}>
            <AdwViewStackPage
                name="first"
                title="First"
                iconName="go-home-symbolic"
                onNotifyTitle={onNotifyFirstTitle}
            >
                {pageRoot("First", isBoxed)}
            </AdwViewStackPage>
            <AdwViewStackPage name="second" title="Second" onNotifyTitle={onNotifySecondTitle}>
                <GtkLabel>Second</GtkLabel>
            </AdwViewStackPage>
        </AdwViewStack>
    );
}

describe("render - ViewStack page order", () => {
    it("keeps the declared order when a middle page's root widget is replaced", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["a", "b", "c"]), buildRootPages(stackRef));
        expect(pageNames(stackRef.current)).toEqual(["a", "b", "c"]);
        await rerender(boxed(["a", "b", "c"], ["b"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "b", "c"]);
        expect(stackRef.current?.getChildByName("b")).toBeInstanceOf(Gtk.Box);
        expect(viewPage(stackRef.current, "b")).toHaveObjectProperty("title", "b");
        expect(viewPage(stackRef.current, "a")).toHaveObjectProperty("title", "a");
    });

    it("keeps the declared order when every page but the last is replaced", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["a", "b", "c"]), buildRootPages(stackRef));
        await rerender(boxed(["a", "b", "c"], ["a", "b"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "b", "c"]);
        expect(stackRef.current?.getChildByName("a")).toBeInstanceOf(Gtk.Box);
        expect(stackRef.current?.getChildByName("b")).toBeInstanceOf(Gtk.Box);
    });

    it("keeps the declared order when the last page's root widget is replaced", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["a", "b", "c"]), buildRootPages(stackRef));
        await rerender(boxed(["a", "b", "c"], ["c"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "b", "c"]);
        expect(stackRef.current?.getChildByName("c")).toBeInstanceOf(Gtk.Box);
    });

    it("keeps the reordered order when a moved page's root widget is replaced", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["a", "b", "c"]), buildRootPages(stackRef));
        await rerender(plain(["b", "a", "c"]));
        expect(pageNames(stackRef.current)).toEqual(["b", "a", "c"]);
        await rerender(boxed(["b", "a", "c"], ["a"]));
        expect(pageNames(stackRef.current)).toEqual(["b", "a", "c"]);
        expect(stackRef.current?.getChildByName("a")).toBeInstanceOf(Gtk.Box);
    });

    it("returns a page to its declared slot when its content comes back", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(loaded(["a", "b", "c"], []), buildLoadedPages(stackRef));
        await rerender(loaded(["a", "b", "c"], ["b"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "c"]);
        await rerender(loaded(["a", "b", "c"], []));
        expect(pageNames(stackRef.current)).toEqual(["a", "b", "c"]);
        expect(stackRef.current?.getChildByName("b")).toBeInstanceOf(Gtk.Label);
    });

    it("places a new page before a page that has no content yet", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(loaded(["a", "b", "c"], ["b"]), buildLoadedPages(stackRef));
        expect(pageNames(stackRef.current)).toEqual(["a", "c"]);
        await rerender(loaded(["a", "x", "b", "c"], ["b"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "x", "c"]);
        await rerender(loaded(["a", "x", "b", "c"], []));
        expect(pageNames(stackRef.current)).toEqual(["a", "x", "b", "c"]);
    });

    it("inserts a page in the middle", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["first", "last"]), buildRootPages(stackRef));
        await rerender(plain(["first", "middle", "last"]));
        expect(pageNames(stackRef.current)).toEqual(["first", "middle", "last"]);
    });

    it("removes a page from the middle", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const { rerender } = await renderChildren(plain(["a", "b", "c"]), buildRootPages(stackRef));
        await rerender(plain(["a", "c"]));
        expect(pageNames(stackRef.current)).toEqual(["a", "c"]);
    });

    it("keeps page handlers connected after a root widget is replaced", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const first: (string | null)[] = [];
        const second: (string | null)[] = [];

        const onNotifyFirstTitle = (value: string | null): void => {
            first.push(value);
        };

        const onNotifySecondTitle = (value: string | null): void => {
            second.push(value);
        };

        const { rerender } = await render(
            <NotifiedRoot
                stackRef={stackRef}
                isBoxed={false}
                onNotifyFirstTitle={onNotifyFirstTitle}
                onNotifySecondTitle={onNotifySecondTitle}
            />,
        );

        await rerender(
            <NotifiedRoot
                stackRef={stackRef}
                isBoxed={true}
                onNotifyFirstTitle={onNotifyFirstTitle}
                onNotifySecondTitle={onNotifySecondTitle}
            />,
        );

        viewPage(stackRef.current, "first")?.setTitle("Renamed first");
        viewPage(stackRef.current, "second")?.setTitle("Renamed second");
        expect(first).toEqual(["Renamed first"]);
        expect(second).toEqual(["Renamed second"]);
        expect(viewPage(stackRef.current, "first")).toHaveObjectProperty("iconName", "go-home-symbolic");
    });

    it("throws when a page's root widget is replaced by a non-widget", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const { rerender } = await render(
            <AdwViewStack ref={stackRef}>
                <AdwViewStackPage name="first" title="First">
                    <GtkLabel>First</GtkLabel>
                </AdwViewStackPage>
            </AdwViewStack>,
        );

        await expect(
            rerender(
                <AdwViewStack ref={stackRef}>
                    <AdwViewStackPage name="first" title="First">
                        <GtkAdjustment />
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });
});
