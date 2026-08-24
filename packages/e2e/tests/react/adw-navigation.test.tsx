import type { NavigationStackEntry, ViewStackPageTransition } from "@gtkx/react/adw";
import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwNavigationView,
    AdwOverlaySplitView,
    AdwSidebar,
    AdwSidebarItem,
    AdwSidebarSection,
    AdwViewStack,
    AdwViewStackPage,
} from "@gtkx/jsx/adw";
import { GtkLabel, GtkNotebook, GtkNotebookPage, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { act, render, screen, waitFor } from "@gtkx/testing";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, Suspense, use } from "react";
import { describe, expect, it } from "vitest";
import { TwoNavigationPages } from "../helpers/navigation-view-render.js";

function ReorderablePageApp({
    notebookRef,
    contentRef,
    isReorderable,
}: {
    notebookRef: RefObject<Gtk.Notebook | null>;
    contentRef: RefObject<Gtk.Label | null>;
    isReorderable: boolean;
}) {
    return (
        <GtkNotebook ref={notebookRef}>
            <GtkNotebookPage tabLabel="Page" reorderable={isReorderable}>
                <GtkLabel ref={contentRef}>Content</GtkLabel>
            </GtkNotebookPage>
        </GtkNotebook>
    );
}

const getItemTitles = (sidebar: Adw.Sidebar | null): string[] => {
    const titles: string[] = [];

    for (let index = 0; ; index += 1) {
        const item = sidebar?.getItem(index) ?? null;

        if (item === null) {
            return titles;
        }

        titles.push(item.getTitle() ?? "");
    }
};

const buildSidebar = (ref: RefObject<Adw.Sidebar | null>) => (titles: string[]) => (
    <AdwSidebar ref={ref}>
        <AdwSidebarSection title="Places">
            {titles.map((title) => (
                <AdwSidebarItem key={title} title={title} />
            ))}
        </AdwSidebarSection>
    </AdwSidebar>
);

const renderSidebar = async (children: ReactNode): Promise<Adw.Sidebar> => {
    const ref = createRef<Adw.Sidebar>();
    await render(<AdwSidebar ref={ref}>{children}</AdwSidebar>);
    const { current } = ref;

    if (!current) {
        throw new TypeError("Expected a Sidebar instance");
    }

    return current;
};

const ControlledNavigationView = ({
    viewRef,
    navigationStack,
    animateTransitions,
    onPopped,
}: {
    viewRef: RefObject<Adw.NavigationView | null>;
    navigationStack?: readonly NavigationStackEntry[];
    animateTransitions?: boolean;
    onPopped?: () => void;
}): ReactNode => (
    <AdwNavigationView
        ref={viewRef}
        navigationStack={navigationStack}
        animateTransitions={animateTransitions}
        onPopped={onPopped}
    >
        <AdwNavigationPage tag="root" title="Root">
            <GtkLabel>Root Content</GtkLabel>
        </AdwNavigationPage>
        <AdwNavigationPage tag="detail" title="Detail">
            <GtkLabel>Detail Content</GtkLabel>
        </AdwNavigationPage>
        <AdwNavigationPage tag="other" title="Other">
            <GtkLabel>Other Content</GtkLabel>
        </AdwNavigationPage>
    </AdwNavigationView>
);

const ControlledViewStack = ({
    stackRef,
    names = ["first", "second", "third"],
    visibleChildName,
    pageTransitions,
    enableTransitions,
}: {
    stackRef: RefObject<Adw.ViewStack | null>;
    names?: readonly string[];
    visibleChildName: string;
    pageTransitions?: readonly ViewStackPageTransition[];
    enableTransitions?: boolean;
}): ReactNode => (
    <AdwViewStack
        ref={stackRef}
        visibleChildName={visibleChildName}
        pageTransitions={pageTransitions}
        enableTransitions={enableTransitions}
    >
        {names.map((name) => (
            <AdwViewStackPage key={name} name={name} title={name}>
                <GtkLabel>{`${name} content`}</GtkLabel>
            </AdwViewStackPage>
        ))}
    </AdwViewStack>
);

const ControlledOverlaySplitView = ({
    viewRef,
    isCollapsed,
    isPinned,
    isSidebarShown,
    label = "Overlay Content",
}: {
    viewRef: RefObject<Adw.OverlaySplitView | null>;
    isCollapsed?: boolean | null;
    isPinned?: boolean | null;
    isSidebarShown?: boolean | null;
    label?: string;
}): ReactNode => (
    <AdwOverlaySplitView
        ref={viewRef}
        collapsed={isCollapsed}
        pinSidebar={isPinned}
        showSidebar={isSidebarShown}
        sidebar={<GtkLabel>Overlay Sidebar</GtkLabel>}
    >
        <GtkLabel>{label}</GtkLabel>
    </AdwOverlaySplitView>
);

const ControlledNavigationSplitView = ({
    viewRef,
    showContent,
}: {
    viewRef: RefObject<Adw.NavigationSplitView | null>;
    showContent: boolean | null;
}): ReactNode => (
    <AdwNavigationSplitView ref={viewRef} collapsed showContent={showContent}>
        <AdwNavigationPage tag="content" title="Content">
            <GtkLabel>Split Content</GtkLabel>
        </AdwNavigationPage>
    </AdwNavigationSplitView>
);

describe("render - NavigationPage (1)", () => {
    it("adds page with id", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="home" title="Home">
                    <GtkLabel>Home Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Home Content");
        expect(viewRef.current?.findPage("home")).not.toBeNull();
    });

    it("adds page with title", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="main" title="Main Page">
                    <GtkLabel>Main Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Main Content");
        expect(viewRef.current?.findPage("main")?.getTitle()).toBe("Main Page");
    });

    it("adds multiple pages", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <TwoNavigationPages contentPrefix="Content" />
            </AdwNavigationView>,
        );

        expect(viewRef.current?.findPage("page1")).not.toBeNull();
        expect(viewRef.current?.findPage("page2")).not.toBeNull();
    });
});

describe("render - NavigationPage (2)", () => {
    it("sets canPop property", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        await render(
            <AdwNavigationView ref={viewRef}>
                <AdwNavigationPage tag="root" title="Root" canPop={false}>
                    <GtkLabel>Root Page</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationView>,
        );

        await screen.findByText("Root Page");
        const page = viewRef.current?.findPage("root");
        expect(page).toHaveObjectProperty("canPop", false);
    });

    it("removes page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ shouldShowPage }: { shouldShowPage: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="permanent" title="Permanent">
                        <GtkLabel>Always Here</GtkLabel>
                    </AdwNavigationPage>
                    {shouldShowPage && (
                        <AdwNavigationPage tag="removable" title="Removable">
                            <GtkLabel>Maybe Here</GtkLabel>
                        </AdwNavigationPage>
                    )}
                </AdwNavigationView>
            );
        }

        await render(<App shouldShowPage={true} />);
        expect(viewRef.current?.findPage("removable")).not.toBeNull();
        await render(<App shouldShowPage={false} />);
        expect(viewRef.current?.findPage("removable")).toBeNull();
    });
});

describe("render - NavigationPage (3)", () => {
    it("updates page title when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ title }: { title: string }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="dynamic" title={title}>
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>
            );
        }

        await render(<App title="Initial Title" />);
        let page = viewRef.current?.findPage("dynamic");
        expect(page).toHaveObjectProperty("title", "Initial Title");
        await render(<App title="Updated Title" />);
        page = viewRef.current?.findPage("dynamic");
        expect(page).toHaveObjectProperty("title", "Updated Title");
    });

    it("updates canPop when prop changes", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        function App({ canPop }: { canPop: boolean }) {
            return (
                <AdwNavigationView ref={viewRef}>
                    <AdwNavigationPage tag="page" title="Page" canPop={canPop}>
                        <GtkLabel>Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>
            );
        }

        await render(<App canPop={true} />);
        let page = viewRef.current?.findPage("page");
        expect(page).toHaveObjectProperty("canPop", true);
        await render(<App canPop={false} />);
        page = viewRef.current?.findPage("page");
        expect(page).toHaveObjectProperty("canPop", false);
    });
});

describe("render - controlled NavigationView stack", () => {
    it("follows declarative pushes and pops with each page's animation policy", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;
        const detail = [...root, { tag: "detail", animateTransitions: true }] as const;

        const { rerender } = await render(
            <ControlledNavigationView viewRef={viewRef} navigationStack={detail} />,
        );

        await waitFor(() => {
            expect(viewRef.current?.getVisiblePage()?.getTag()).toBe("detail");
            expect(viewRef.current?.getAnimateTransitions()).toBe(true);
        });

        await rerender(<ControlledNavigationView viewRef={viewRef} navigationStack={root} />);

        await waitFor(() => {
            expect(viewRef.current?.getVisiblePage()?.getTag()).toBe("root");
            expect(viewRef.current?.getAnimateTransitions()).toBe(false);
        });
    });
});

describe("render - abandoned controlled NavigationView", () => {
    it("does not reconcile or subscribe before its tree commits", async () => {
        const { promise: pending } = Promise.withResolvers<never>();

        const Pending = (): ReactNode => {
            use(pending);

            return null;
        };

        const stack = [
            { tag: "root", animateTransitions: false },
            { tag: "detail", animateTransitions: false },
        ] as const;

        let showing = 0;

        await render(
            <Suspense fallback={<GtkLabel>Fallback</GtkLabel>}>
                <AdwNavigationView navigationStack={stack}>
                    <AdwNavigationPage tag="root" title="Root">
                        <GtkLabel>Root Content</GtkLabel>
                    </AdwNavigationPage>
                    <AdwNavigationPage
                        tag="detail"
                        title="Detail"
                        onShowing={() => {
                            showing += 1;
                        }}
                    >
                        <GtkLabel>Detail Content</GtkLabel>
                    </AdwNavigationPage>
                </AdwNavigationView>
                <Pending />
            </Suspense>,
        );

        expect(screen.getByText("Fallback")).toBeRooted();

        await act(async () => {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 0);
            });
        });

        expect(showing).toBe(0);
    });
});

describe("render - controlled NavigationView replacement", () => {
    it("restores native drift and suppresses renderer-originated pop events", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;
        const detail = [...root, { tag: "detail", animateTransitions: false }] as const;
        let popped = 0;

        const { rerender } = await render(
            <ControlledNavigationView
                viewRef={viewRef}
                navigationStack={detail}
                onPopped={() => {
                    popped += 1;
                }}
            />,
        );

        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationView instance");
        }

        await act(() => {
            view.pop();
        });

        expect(popped).toBe(1);

        await waitFor(() => {
            expect(view.getVisiblePage()?.getTag()).toBe("detail");
        });

        popped = 0;

        await rerender(
            <ControlledNavigationView
                viewRef={viewRef}
                navigationStack={root}
                onPopped={() => {
                    popped += 1;
                }}
            />,
        );

        await waitFor(() => {
            expect(view.getVisiblePage()?.getTag()).toBe("root");
        });

        expect(popped).toBe(0);
    });
});

describe("render - controlled NavigationView multi-page replacement", () => {
    it("does not show an intermediate page", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;

        const extended = [
            ...root,
            { tag: "detail", animateTransitions: false },
            { tag: "other", animateTransitions: false },
        ] as const;

        const { rerender } = await render(
            <ControlledNavigationView viewRef={viewRef} navigationStack={root} />,
        );

        const view = viewRef.current;
        const intermediate = view?.findPage("detail") ?? null;

        if (view === null || intermediate === null) {
            throw new TypeError("Expected the controlled NavigationView pages");
        }

        const lifecycle: string[] = [];

        const onShowing = (): void => {
            lifecycle.push("showing");
        };

        const onShown = (): void => {
            lifecycle.push("shown");
        };

        intermediate.on("showing", onShowing);
        intermediate.on("shown", onShown);
        await rerender(<ControlledNavigationView viewRef={viewRef} navigationStack={extended} />);
        intermediate.off("showing", onShowing);
        intermediate.off("shown", onShown);
        expect(view.getVisiblePage()?.getTag()).toBe("other");
        expect(lifecycle).toEqual([]);
    });
});

describe("render - controlled NavigationView untagged drift", () => {
    it("restores the canonical stack after a dynamic untagged page is pushed", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;
        await render(<ControlledNavigationView viewRef={viewRef} navigationStack={root} />);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationView instance");
        }

        const dynamic = Adw.NavigationPage.new(Gtk.Label.new("Dynamic Content"), "Dynamic");

        await act(() => {
            view.push(dynamic);
        });

        await waitFor(() => {
            expect(view.getVisiblePage()?.getTag()).toBe("root");
            expect(view.getNavigationStack().getNItems()).toBe(1);
        });
    });
});

describe("render - controlled NavigationView fallback", () => {
    it("restores a changed explicit transition fallback when control is removed", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;

        const { rerender } = await render(
            <ControlledNavigationView
                viewRef={viewRef}
                navigationStack={root}
                animateTransitions={false}
            />,
        );

        expect(viewRef.current?.getAnimateTransitions()).toBe(false);

        await rerender(
            <ControlledNavigationView viewRef={viewRef} animateTransitions />,
        );

        expect(viewRef.current?.getAnimateTransitions()).toBe(true);
    });

    it("restores the native default when both controlling props are omitted", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: false }] as const;

        const { rerender } = await render(
            <ControlledNavigationView
                viewRef={viewRef}
                navigationStack={root}
                animateTransitions
            />,
        );

        expect(viewRef.current?.getAnimateTransitions()).toBe(false);
        await rerender(<ControlledNavigationView viewRef={viewRef} />);
        expect(viewRef.current?.getAnimateTransitions()).toBe(true);
    });

    it("captures the live native fallback when stack control is introduced", async () => {
        const viewRef = createRef<Adw.NavigationView>();
        const root = [{ tag: "root", animateTransitions: true }] as const;
        const { rerender } = await render(<ControlledNavigationView viewRef={viewRef} />);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationView instance");
        }

        await act(() => {
            view.setAnimateTransitions(false);
        });

        await rerender(<ControlledNavigationView viewRef={viewRef} navigationStack={root} />);
        expect(view.getAnimateTransitions()).toBe(true);
        await rerender(<ControlledNavigationView viewRef={viewRef} />);
        expect(view.getAnimateTransitions()).toBe(false);
    });
});

describe("render - controlled NavigationView animation", () => {
    it("sets the destination policy before replacing unrelated stacks", async () => {
        const viewRef = createRef<Adw.NavigationView>();

        const detail = [
            { tag: "root", animateTransitions: false },
            { tag: "detail", animateTransitions: false },
        ] as const;

        const other = [
            { tag: "root", animateTransitions: false },
            { tag: "other", animateTransitions: true },
        ] as const;

        const { rerender } = await render(
            <ControlledNavigationView viewRef={viewRef} navigationStack={detail} />,
        );

        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationView instance");
        }

        const observedPolicies: boolean[] = [];

        const onVisiblePageChanged = (): void => {
            observedPolicies.push(view.getAnimateTransitions());
        };

        view.on("notify::visible-page", onVisiblePageChanged);
        await rerender(<ControlledNavigationView viewRef={viewRef} navigationStack={other} />);
        view.off("notify::visible-page", onVisiblePageChanged);
        expect(view.getVisiblePage()?.getTag()).toBe("other");
        expect(observedPolicies.length).toBeGreaterThan(0);
        expect(observedPolicies).not.toContain(false);
    });
});

describe("render - controlled ViewStack transitions (1)", () => {
    it("animates a declarative switch to an animated destination", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const pageTransitions = [
            { name: "first", animateTransitions: false },
            { name: "second", animateTransitions: true },
            { name: "third", animateTransitions: false },
        ] as const;

        const { rerender } = await render(
            <ControlledViewStack
                stackRef={stackRef}
                visibleChildName="first"
                pageTransitions={pageTransitions}
            />,
            { areAnimationsEnabled: true },
        );

        const stack = stackRef.current;

        if (stack === null) {
            throw new TypeError("Expected a ViewStack instance");
        }

        const visiblePolicies: boolean[] = [];

        const onVisibleChildChanged = (): void => {
            visiblePolicies.push(stack.getEnableTransitions());
        };

        expect(stack.getEnableTransitions()).toBe(false);
        stack.on("notify::visible-child-name", onVisibleChildChanged);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                visibleChildName="second"
                pageTransitions={pageTransitions}
            />,
        );

        stack.off("notify::visible-child-name", onVisibleChildChanged);
        expect(stack.getVisibleChildName()).toBe("second");
        expect(stack.getEnableTransitions()).toBe(true);
        expect(visiblePolicies).toEqual([true]);
        expect(stack.getTransitionRunning()).toBe(true);

        await waitFor(() => {
            expect(stack.getTransitionRunning()).toBe(false);
        });
    });
});

describe("render - controlled ViewStack transitions (2)", () => {
    it("does not animate a declarative switch to a non-animated destination", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const pageTransitions = [
            { name: "second", animateTransitions: true },
            { name: "third", animateTransitions: false },
        ] as const;

        const { rerender } = await render(
            <ControlledViewStack
                stackRef={stackRef}
                names={["second", "third"]}
                visibleChildName="second"
                pageTransitions={pageTransitions}
            />,
            { areAnimationsEnabled: true },
        );

        const stack = stackRef.current;

        if (stack === null) {
            throw new TypeError("Expected a ViewStack instance");
        }

        expect(stack.getTransitionRunning()).toBe(false);
        const visiblePolicies: boolean[] = [];

        const onVisibleChildChanged = (): void => {
            visiblePolicies.push(stack.getEnableTransitions());
        };

        stack.on("notify::visible-child-name", onVisibleChildChanged);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                names={["second", "third"]}
                visibleChildName="third"
                pageTransitions={pageTransitions}
            />,
        );

        stack.off("notify::visible-child-name", onVisibleChildChanged);
        expect(stack.getVisibleChildName()).toBe("third");
        expect(stack.getEnableTransitions()).toBe(false);
        expect(visiblePolicies).toEqual([false]);

        await waitFor(() => {
            expect(stack.getTransitionRunning()).toBe(false);
        });
    });
});

describe("render - controlled ViewStack transitions (2b)", () => {
    it("restores the controlled page and its policy after a native switch", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const pageTransitions = [
            { name: "first", animateTransitions: false },
            { name: "second", animateTransitions: true },
        ] as const;

        await render(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="first"
                pageTransitions={pageTransitions}
            />,
        );

        const stack = stackRef.current;

        if (stack === null) {
            throw new TypeError("Expected a ViewStack instance");
        }

        await act(() => {
            stack.setVisibleChildName("second");
            expect(stack.getEnableTransitions()).toBe(true);
        });

        await waitFor(() => {
            expect(stack.getVisibleChildName()).toBe("first");
            expect(stack.getEnableTransitions()).toBe(false);
        });
    });
});

describe("render - controlled ViewStack acquired fallback", () => {
    it("uses and restores the live native fallback around optional control", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const { rerender } = await render(
            <ControlledViewStack stackRef={stackRef} visibleChildName="first" />,
        );

        const stack = stackRef.current;

        if (stack === null) {
            throw new TypeError("Expected a ViewStack instance");
        }

        await act(() => {
            stack.setEnableTransitions(false);
        });

        const pageTransitions = [{ name: "second", animateTransitions: true }] as const;

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                visibleChildName="first"
                pageTransitions={pageTransitions}
            />,
        );

        expect(stack.getEnableTransitions()).toBe(false);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                visibleChildName="second"
                pageTransitions={pageTransitions}
            />,
        );

        expect(stack.getEnableTransitions()).toBe(true);
        await rerender(<ControlledViewStack stackRef={stackRef} visibleChildName="second" />);
        expect(stack.getEnableTransitions()).toBe(false);
    });
});

describe("render - controlled ViewStack transitions (3)", () => {
    it("leaves the native transition default alone without pageTransitions", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        await render(
            <AdwViewStack ref={stackRef}>
                <AdwViewStackPage name="first" title="first">
                    <GtkLabel>first content</GtkLabel>
                </AdwViewStackPage>
                <AdwViewStackPage name="second" title="second">
                    <GtkLabel>second content</GtkLabel>
                </AdwViewStackPage>
            </AdwViewStack>,
        );

        const stack = stackRef.current;

        if (stack === null) {
            throw new TypeError("Expected a ViewStack instance");
        }

        expect(stack.getEnableTransitions()).toBe(false);
        const transitionStates: boolean[] = [];

        const onTransitionRunningChanged = (): void => {
            transitionStates.push(stack.getTransitionRunning());
        };

        stack.on("notify::transition-running", onTransitionRunningChanged);

        await act(() => {
            stack.setEnableTransitions(true);
            stack.setVisibleChildName("second");
        });

        stack.off("notify::transition-running", onTransitionRunningChanged);
        expect(stack.getEnableTransitions()).toBe(true);
        expect(transitionStates).toContain(true);
    });
});

describe("render - controlled ViewStack transitions (4)", () => {
    it("updates page names and policies in the same commit", async () => {
        const stackRef = createRef<Adw.ViewStack>();

        const { rerender } = await render(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="first"
                pageTransitions={[
                    { name: "first", animateTransitions: false },
                    { name: "second", animateTransitions: false },
                ]}
            />,
        );

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "third"]}
                visibleChildName="third"
                pageTransitions={[
                    { name: "first", animateTransitions: false },
                    { name: "third", animateTransitions: true },
                ]}
            />,
        );

        expect(stackRef.current?.getVisibleChildName()).toBe("third");
        expect(stackRef.current?.getEnableTransitions()).toBe(true);
    });
});

describe("render - controlled ViewStack transitions (5)", () => {
    it("uses and resets enableTransitions as the policy fallback", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const pageTransitions = [{ name: "first", animateTransitions: false }] as const;

        const { rerender } = await render(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="first"
                pageTransitions={pageTransitions}
                enableTransitions
            />,
        );

        expect(stackRef.current?.getEnableTransitions()).toBe(false);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="second"
                pageTransitions={pageTransitions}
                enableTransitions
            />,
        );

        expect(stackRef.current?.getEnableTransitions()).toBe(true);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="second"
                pageTransitions={pageTransitions}
            />,
        );

        expect(stackRef.current?.getEnableTransitions()).toBe(false);
    });
});

describe("render - controlled ViewStack transitions (6)", () => {
    it("restores the native fallback before switching to an unlisted page", async () => {
        const stackRef = createRef<Adw.ViewStack>();
        const pageTransitions = [{ name: "first", animateTransitions: false }] as const;

        const { rerender } = await render(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="first"
                pageTransitions={pageTransitions}
                enableTransitions
            />,
        );

        expect(stackRef.current?.getEnableTransitions()).toBe(false);

        await rerender(
            <ControlledViewStack
                stackRef={stackRef}
                names={["first", "second"]}
                visibleChildName="second"
                pageTransitions={pageTransitions}
            />,
        );

        expect(stackRef.current?.getVisibleChildName()).toBe("second");
        expect(stackRef.current?.getEnableTransitions()).toBe(false);
    });
});

describe("render - NavigationSplitView", () => {
    it("sets the content page", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        await render(
            <AdwNavigationSplitView ref={viewRef}>
                <AdwNavigationPage tag="content" title="Content">
                    <GtkLabel>Split Content</GtkLabel>
                </AdwNavigationPage>
            </AdwNavigationSplitView>,
        );

        await screen.findByText("Split Content");
        expect(viewRef.current?.getContent()).toHaveObjectProperty("tag", "content");
    });

    it("clears the content page when unmounted", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();

        function App({ shouldShowContent }: { shouldShowContent: boolean }) {
            return (
                <AdwNavigationSplitView ref={viewRef}>
                    {shouldShowContent && (
                        <AdwNavigationPage tag="content" title="Content">
                            <GtkLabel>Split Content</GtkLabel>
                        </AdwNavigationPage>
                    )}
                </AdwNavigationSplitView>
            );
        }

        const { rerender } = await render(<App shouldShowContent={true} />);
        expect(viewRef.current?.getContent()).not.toBeNull();
        await rerender(<App shouldShowContent={false} />);
        expect(viewRef.current?.getContent()).toBeNull();
    });
});

describe("render - controlled NavigationSplitView", () => {
    it("keeps showContent controlled across declarative and native changes", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();
        const { rerender } = await render(<ControlledNavigationSplitView viewRef={viewRef} showContent />);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationSplitView instance");
        }

        expect(view.getShowContent()).toBe(true);

        await act(() => {
            view.setShowContent(false);
        });

        await waitFor(() => {
            expect(view.getShowContent()).toBe(true);
        });

        await rerender(<ControlledNavigationSplitView viewRef={viewRef} showContent={false} />);
        expect(view.getShowContent()).toBe(false);
    });
});

describe("render - nullable NavigationSplitView", () => {
    it("releases showContent control when set to null", async () => {
        const viewRef = createRef<Adw.NavigationSplitView>();
        const { rerender } = await render(<ControlledNavigationSplitView viewRef={viewRef} showContent />);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected a NavigationSplitView instance");
        }

        await rerender(<ControlledNavigationSplitView viewRef={viewRef} showContent={null} />);

        await act(() => {
            view.setShowContent(false);
        });

        await waitFor(() => {
            expect(view.getShowContent()).toBe(false);
        });
    });
});

describe("render - controlled OverlaySplitView mode", () => {
    it("preserves controlled visibility across simultaneous pin and collapse changes", async () => {
        const viewRef = createRef<Adw.OverlaySplitView>();

        const { rerender } = await render(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed={false}
                isPinned={false}
                isSidebarShown
            />,
        );

        await rerender(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed
                isPinned
                isSidebarShown
            />,
        );

        expect(viewRef.current?.getCollapsed()).toBe(true);
        expect(viewRef.current?.getPinSidebar()).toBe(true);
        expect(viewRef.current?.getShowSidebar()).toBe(true);

        await rerender(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed={false}
                isPinned={false}
                isSidebarShown={false}
            />,
        );

        expect(viewRef.current?.getCollapsed()).toBe(false);
        expect(viewRef.current?.getPinSidebar()).toBe(false);
        expect(viewRef.current?.getShowSidebar()).toBe(false);
    });
});

describe("render - nullable OverlaySplitView mode", () => {
    it("releases nullable mode properties to their native defaults", async () => {
        const viewRef = createRef<Adw.OverlaySplitView>();

        const { rerender } = await render(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed
                isPinned
                isSidebarShown={false}
            />,
        );

        await rerender(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed={null}
                isPinned={null}
                isSidebarShown={null}
            />,
        );

        expect(viewRef.current?.getCollapsed()).toBe(false);
        expect(viewRef.current?.getPinSidebar()).toBe(false);
        expect(viewRef.current?.getShowSidebar()).toBe(true);
    });
});

describe("render - uncontrolled OverlaySplitView mode", () => {
    it("leaves omitted mode properties under native control across unrelated renders", async () => {
        const viewRef = createRef<Adw.OverlaySplitView>();
        const { rerender } = await render(<ControlledOverlaySplitView viewRef={viewRef} />);
        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected an OverlaySplitView instance");
        }

        await act(() => {
            view.setPinSidebar(true);
            view.setCollapsed(true);
            view.setShowSidebar(false);
        });

        expect(view.getPinSidebar()).toBe(true);
        expect(view.getCollapsed()).toBe(true);
        expect(view.getShowSidebar()).toBe(false);
        await rerender(<ControlledOverlaySplitView viewRef={viewRef} label="Updated Content" />);
        expect(view.getPinSidebar()).toBe(true);
        expect(view.getCollapsed()).toBe(true);
        expect(view.getShowSidebar()).toBe(false);
    });
});

describe("render - controlled OverlaySplitView native drift", () => {
    it("restores all controlled mode properties after native drift", async () => {
        const viewRef = createRef<Adw.OverlaySplitView>();

        await render(
            <ControlledOverlaySplitView
                viewRef={viewRef}
                isCollapsed={false}
                isPinned={false}
                isSidebarShown
            />,
        );

        const view = viewRef.current;

        if (view === null) {
            throw new TypeError("Expected an OverlaySplitView instance");
        }

        await act(() => {
            view.setPinSidebar(true);
            view.setCollapsed(true);
            view.setShowSidebar(false);
        });

        await waitFor(() => {
            expect(view.getPinSidebar()).toBe(false);
            expect(view.getCollapsed()).toBe(false);
            expect(view.getShowSidebar()).toBe(true);
        });
    });
});

describe("render - page adoption > NotebookPage (1)", () => {
    it("exposes the real Gtk.NotebookPage through ref", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();
        const pageRef = createRef<Gtk.NotebookPage>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage ref={pageRef} tabLabel="Page">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(pageRef.current).toBe(page);
        expect(pageRef.current).toHaveObjectProperty("child", contentRef.current);
    });

    it("applies reorderable, detachable and menuLabel declaratively", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        await render(
            <GtkNotebook ref={notebookRef}>
                <GtkNotebookPage tabLabel="Page" reorderable detachable menuLabel="Menu Entry">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkNotebookPage>
            </GtkNotebook>,
        );

        const page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("reorderable", true);
        expect(page).toHaveObjectProperty("detachable", true);
        expect(page).toHaveObjectProperty("menuLabel", "Menu Entry");
    });
});

describe("render - page adoption > NotebookPage (2)", () => {
    it("resets a page prop to its default when it is removed", async () => {
        const notebookRef = createRef<Gtk.Notebook>();
        const contentRef = createRef<Gtk.Label>();

        const { rerender } = await render(
            <ReorderablePageApp notebookRef={notebookRef} contentRef={contentRef} isReorderable={true} />,
        );

        let page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("reorderable", true);

        await rerender(
            <ReorderablePageApp notebookRef={notebookRef} contentRef={contentRef} isReorderable={false} />,
        );

        page = notebookRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(page).toHaveObjectProperty("reorderable", false);
    });
});

describe("render - page adoption > StackPage", () => {
    it("exposes the real Gtk.StackPage through ref", async () => {
        const stackRef = createRef<Gtk.Stack>();
        const contentRef = createRef<Gtk.Label>();
        const pageRef = createRef<Gtk.StackPage>();

        await render(
            <GtkStack ref={stackRef}>
                <GtkStackPage ref={pageRef} name="page" title="Title">
                    <GtkLabel ref={contentRef}>Content</GtkLabel>
                </GtkStackPage>
            </GtkStack>,
        );

        const page = stackRef.current?.getPage(contentRef.current as Gtk.Widget);
        expect(pageRef.current).toBe(page);
        expect(pageRef.current).toHaveObjectProperty("title", "Title");
    });
});

describe("render - AdwSidebar", () => {
    it("adds sections declared as children", async () => {
        const sidebar = await renderSidebar(
            <>
                <AdwSidebarSection title="Places" />
                <AdwSidebarSection title="Tags" />
            </>,
        );

        expect(sidebar.getSections().getNItems()).toBe(2);
        expect(sidebar.getSection(0)?.getTitle()).toBe("Places");
        expect(sidebar.getSection(1)?.getTitle()).toBe("Tags");
    });

    it("adds items declared as children of a section", async () => {
        const sidebar = await renderSidebar(
            <AdwSidebarSection title="Places">
                <AdwSidebarItem title="Home" />
                <AdwSidebarItem title="Documents" />
            </AdwSidebarSection>,
        );

        expect(getItemTitles(sidebar)).toEqual(["Home", "Documents"]);
        expect(sidebar.getSection(0)?.getItem(0)?.getTitle()).toBe("Home");
    });

    it("removes items when the list shrinks", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Documents"], buildSidebar(ref));
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents"]);
        await rerender(["Home"]);
        expect(getItemTitles(ref.current)).toEqual(["Home"]);
    });

    it("inserts an item in the middle", async () => {
        const ref = createRef<Adw.Sidebar>();
        const { rerender } = await renderChildren(["Home", "Trash"], buildSidebar(ref));
        await rerender(["Home", "Documents", "Trash"]);
        expect(getItemTitles(ref.current)).toEqual(["Home", "Documents", "Trash"]);
    });
});
