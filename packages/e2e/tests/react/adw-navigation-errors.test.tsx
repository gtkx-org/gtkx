import type { ViewStackPageTransition } from "@gtkx/react/adw";
import * as Adw from "@gtkx/gi/adw";
import {
    AdwNavigationPage,
    AdwNavigationView,
    AdwOverlaySplitView,
    AdwViewStack,
    AdwViewStackPage,
} from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

describe("render - controlled NavigationView errors", () => {
    it("rejects duplicate page tags", async () => {
        await expect(
            render(
                <AdwNavigationView
                    navigationStack={[
                        { tag: "root", animateTransitions: false },
                        { tag: "root", animateTransitions: true },
                    ]}
                >
                    <AdwNavigationPage tag="root" title="Root">
                        <GtkLabel>Root Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>,
            ),
        ).rejects.toThrow();
    });
});

describe("render - controlled NavigationView membership errors", () => {
    it("rejects an unknown page tag after mounting", async () => {
        const { rerender } = await render(
            <AdwNavigationView navigationStack={[{ tag: "root", animateTransitions: false }]}>
                <AdwNavigationPage tag="root" title="Root">
                    <GtkLabel>Root Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await expect(
            rerender(
                <AdwNavigationView navigationStack={[{ tag: "missing", animateTransitions: false }]}>
                    <AdwNavigationPage tag="root" title="Root">
                        <GtkLabel>Root Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>,
            ),
        ).rejects.toThrow();
    });

    it("rejects an unknown tag while replacing pages", async () => {
        const { rerender } = await render(
            <AdwNavigationView navigationStack={[{ tag: "root", animateTransitions: false }]}>
                <AdwNavigationPage tag="root" title="Root">
                    <GtkLabel>Root Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await expect(
            rerender(
                <AdwNavigationView navigationStack={[{ tag: "missing", animateTransitions: false }]}>
                    <AdwNavigationPage tag="other" title="Other">
                        <GtkLabel>Other Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>,
            ),
        ).rejects.toThrow();
    });
});

describe("render - controlled NavigationView drift errors", () => {
    it("surfaces deferred external page removal on the owning root's next update", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        const tree = (
            <AdwNavigationView
                ref={viewRef}
                navigationStack={[
                    { tag: "root", animateTransitions: false },
                    { tag: "detail", animateTransitions: false },
                ]}
            >
                <AdwNavigationPage tag="root" title="Root">
                    <GtkLabel>Root Content</GtkLabel>
                </AdwNavigationPage>
                <AdwNavigationPage tag="detail" title="Detail">
                    <GtkLabel>Detail Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>
        );

        const rendered = await render(tree);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("expected controlled navigation view");
        }

        const detail = view.findPage("detail");

        if (detail === null) {
            throw new TypeError("expected controlled navigation pages");
        }

        view.pop();
        view.remove(detail);

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        await expect(rendered.unmount()).rejects.toThrow();
    });
});

describe("render - controlled OverlaySplitView errors", () => {
    it("rejects a non-boolean mode property", async () => {
        const props = { collapsed: false };
        Object.defineProperty(props, "collapsed", { value: "invalid" });

        await expect(
            render(
                <AdwOverlaySplitView {...props}>
                    <GtkLabel>Content</GtkLabel>
                </AdwOverlaySplitView>,
            ),
        ).rejects.toThrow();
    });
});

describe("render - controlled ViewStack transition errors", () => {
    it("rejects malformed transition entries", async () => {
        const transition: ViewStackPageTransition = { name: "first", animateTransitions: true };
        Object.defineProperty(transition, "animateTransitions", { value: "invalid" });

        await expect(
            render(
                <AdwViewStack pageTransitions={[transition]}>
                    <AdwViewStackPage name="first" title="First">
                        <GtkLabel>First Content</GtkLabel>
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });

    it("rejects duplicate page names", async () => {
        await expect(
            render(
                <AdwViewStack
                    pageTransitions={[
                        { name: "first", animateTransitions: false },
                        { name: "first", animateTransitions: true },
                    ]}
                >
                    <AdwViewStackPage name="first" title="First">
                        <GtkLabel>First Content</GtkLabel>
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });
});

describe("render - controlled ViewStack membership errors", () => {
    it("rejects unknown page names", async () => {
        const { rerender } = await render(
            <AdwViewStack pageTransitions={[{ name: "first", animateTransitions: false }]}>
                <AdwViewStackPage name="first" title="First">
                    <GtkLabel>First Content</GtkLabel>
                </AdwViewStackPage>
            </AdwViewStack>,
        );

        await expect(
            rerender(
                <AdwViewStack pageTransitions={[{ name: "missing", animateTransitions: true }]}>
                    <AdwViewStackPage name="first" title="First">
                        <GtkLabel>First Content</GtkLabel>
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });

    it("rejects an unknown name while replacing pages", async () => {
        const { rerender } = await render(
            <AdwViewStack pageTransitions={[{ name: "first", animateTransitions: false }]}>
                <AdwViewStackPage name="first" title="First">
                    <GtkLabel>First Content</GtkLabel>
                </AdwViewStackPage>
            </AdwViewStack>,
        );

        await expect(
            rerender(
                <AdwViewStack pageTransitions={[{ name: "missing", animateTransitions: true }]}>
                    <AdwViewStackPage name="second" title="Second">
                        <GtkLabel>Second Content</GtkLabel>
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });
});

describe("render - queued ViewStack validation errors", () => {
    it("rejects a construct-only change without flushing stale page policy", async () => {
        const { rerender } = await render(
            <AdwViewStack
                cssName="first-stack"
                pageTransitions={[{ name: "first", animateTransitions: false }]}
            >
                <AdwViewStackPage name="first" title="First">
                    <GtkLabel>First Content</GtkLabel>
                </AdwViewStackPage>
            </AdwViewStack>,
        );

        await expect(
            rerender(
                <AdwViewStack
                    cssName="second-stack"
                    pageTransitions={[{ name: "second", animateTransitions: false }]}
                >
                    <AdwViewStackPage name="second" title="Second">
                        <GtkLabel>Second Content</GtkLabel>
                    </AdwViewStackPage>
                </AdwViewStack>,
            ),
        ).rejects.toThrow();
    });
});
