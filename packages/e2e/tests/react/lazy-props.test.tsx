import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import { AdwTabPage, AdwTabView } from "@gtkx/jsx/adw";
import { GThemedIcon } from "@gtkx/jsx/gio";
import { GtkBox, GtkEntry } from "@gtkx/jsx/gtk";
import { act, render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("lazy element props", () => {
    it("mounts, replaces and removes JSX icons on an adopted tab page", async () => {
        const page = createRef<Adw.TabPage>();
        const icon = createRef<Gio.ThemedIcon>();
        const indicator = createRef<Gio.ThemedIcon>();
        const app = (name: string | null) => (
            <AdwTabView>
                <AdwTabPage
                    ref={page}
                    title="Icons"
                    icon={name === null ? null : <GThemedIcon key={name} ref={icon} name={name} />}
                    indicatorIcon={
                        name === null ? null : (
                            <GThemedIcon key={name} ref={indicator} name="audio-volume-high-symbolic" />
                        )
                    }
                >
                    <GtkEntry text="Content" />
                </AdwTabPage>
            </AdwTabView>
        );
        const { rerender } = await render(app("document-new-symbolic"));
        const originalPage = page.current;
        const originalIcon = icon.current;
        expect(page.current?.getIcon()).toBe(icon.current);
        expect(page.current?.getIndicatorIcon()).toBe(indicator.current);
        expect(icon.current).not.toBeNull();
        await rerender(app("document-open-symbolic"));
        expect(page.current).toBe(originalPage);
        expect(icon.current).not.toBe(originalIcon);
        expect(page.current?.getIcon()).toBe(icon.current);
        expect(page.current?.getIndicatorIcon()).toBe(indicator.current);
        await rerender(app(null));
        expect(page.current?.getIcon()).toBeNull();
        expect(page.current?.getIndicatorIcon()).toBeNull();
        await rerender(app("document-new-symbolic"));
        expect(page.current?.getIcon()).toBe(icon.current);
        expect(page.current?.getIndicatorIcon()).toBe(indicator.current);
    });

    it("updates JSX icons after a native transfer without recreating the page", async () => {
        const source = createRef<Adw.TabView>();
        const target = createRef<Adw.TabView>();
        const page = createRef<Adw.TabPage>();
        const icon = createRef<Gio.ThemedIcon>();
        const app = (name: string) => (
            <GtkBox>
                <AdwTabView ref={source}>
                    <AdwTabPage ref={page} title="Transferred" icon={<GThemedIcon key={name} ref={icon} name={name} />}>
                        <GtkEntry text="Content" />
                    </AdwTabPage>
                </AdwTabView>
                <AdwTabView ref={target} />
            </GtkBox>
        );
        const { rerender } = await render(app("document-new-symbolic"));
        const originalPage = page.current;
        await act(() => {
            if (source.current && target.current && page.current)
                source.current.transferPage(page.current, target.current, 0);
        });
        await rerender(app("document-open-symbolic"));
        expect(target.current?.getNthPage(0)).toBe(originalPage);
        expect(originalPage?.getIcon()).toBe(icon.current);
        expect(icon.current?.getNames()).toContain("document-open-symbolic");
    });

    it("reattaches JSX props when a lazy page adopts a replacement child", async () => {
        const page = createRef<Adw.TabPage>();
        const icon = createRef<Gio.ThemedIcon>();
        const app = (version: number) => (
            <AdwTabView>
                <AdwTabPage
                    ref={page}
                    title="Replacement"
                    icon={<GThemedIcon ref={icon} name="document-new-symbolic" />}
                >
                    <GtkEntry key={version} text="Content" />
                </AdwTabPage>
            </AdwTabView>
        );
        const { rerender } = await render(app(0));
        const originalPage = page.current;
        const originalIcon = icon.current;
        await rerender(app(1));
        expect(page.current).not.toBe(originalPage);
        expect(icon.current).toBe(originalIcon);
        expect(page.current?.getIcon()).toBe(originalIcon);
    });
});
