import { createNavigationContainerRef } from "@gtkx/navigation";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    createEventSpy,
    createPreventSpy,
    expectHidden,
    expectVisible,
    getNavigationView,
    popToPage,
    pressKeys,
    queryBackButton,
    renderStack,
    type RootParams,
    type StackEvent,
} from "./helpers/stack-fixtures.js";

const getEvents = (onEvent: ReturnType<typeof createEventSpy>): StackEvent[] =>
    onEvent.mock.calls.map(([event]) => event);

describe("stack - events (1)", () => {
    it("emits transition events to the outgoing page and ends the incoming one", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        onEvent.mockClear();
        await clickButton("Go to details");
        await screen.findByText("Details 1");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        const events = getEvents(onEvent);
        expect(events).toContainEqual({ type: "transitionStart", route: "Home", isClosing: true });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Home", isClosing: true });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: false });
    });

    it("emits transitionStart with closing false to the incoming page", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        expect(getEvents(onEvent)).toContainEqual({ type: "transitionStart", route: "Details", isClosing: false });
    });

    it("removes the popped page after the transition", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        onEvent.mockClear();
        await clickButton("Back");
        await screen.findByText("Home Content");

        await waitFor(() => {
            expectHidden("Details 1");
        });

        expect(getEvents(onEvent)).toContainEqual({ type: "transitionEnd", route: "Details", isClosing: true });
    });
});

describe("stack - events (2)", () => {
    it("emits focus and blur on push and pop", async () => {
        const onEvent = createEventSpy();
        await renderStack({ spies: { onEvent } });
        onEvent.mockClear();
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
        const focusEvents = getEvents(onEvent).filter(({ type }) => type === "focus" || type === "blur");

        expect(focusEvents).toEqual([
            { type: "blur", route: "Home", isClosing: undefined },
            { type: "focus", route: "Details", isClosing: undefined },
            { type: "blur", route: "Details", isClosing: undefined },
            { type: "focus", route: "Home", isClosing: undefined },
        ]);
    });

    it("pushes without animating when animation is none", async () => {
        await renderStack({ isAnimated: true, details: { animation: "none" } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        expectHidden("Home Content");
    });

    it("keeps the page visible when usePreventRemove prevents Back", async () => {
        const onPrevent = createPreventSpy();
        const events: StackEvent[] = [];

        const onEvent = (event: StackEvent): void => {
            events.push(event);
        };

        await renderStack({ spies: { onPrevent, onEvent } });
        await clickButton("Go to compose");
        await screen.findByText("Compose Content");
        events.length = 0;
        await clickButton("Back");
        await screen.findByText("Compose Content");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
        expect(events).toEqual([]);
    });
});

describe("stack - events (3)", () => {
    it("keeps the page visible when usePreventRemove prevents Escape", async () => {
        const onPrevent = createPreventSpy();
        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await pressKeys("Compose Content", "{Escape}");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });

    it("pops once the prevented action is dispatched again", async () => {
        const onPrevent = createPreventSpy();
        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        await clickButton("Discard");
        await screen.findByText("Home Content");
        expectHidden("Compose Content");
        expect(onPrevent).toHaveBeenCalledTimes(1);
    });

    it("does not add manual Back or Escape actions to a protected root", async () => {
        let preventions = 0;
        let unhandledActions = 0;

        const onPrevent = (): void => {
            preventions += 1;
        };

        await renderStack({
            navigator: { initialRouteName: "Compose" },
            container: {
                onUnhandledAction: () => {
                    unhandledActions += 1;
                },
            },
            spies: { onPrevent },
        });

        await screen.findByText("Compose Content");
        expect(queryBackButton()).toBeNull();
        await pressKeys("Compose Content", "{Escape}");
        expectVisible("Compose Content");
        expect(preventions).toBe(0);
        expect(unhandledActions).toBe(0);
    });
});

describe("stack - events (4)", () => {
    it("pops without animating when animation is none", async () => {
        await renderStack({ isAnimated: true, details: { animation: "none" } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Push settings");
        await screen.findByText("Settings Content");
        await clickButton("Back");
        await screen.findByText("Details 1");
        await clickButton("Back");
        await screen.findByText("Home Content");
        expectHidden("Details 1");
    });

    it("emits a real reveal after suppressing a multi-route initial transaction", async () => {
        const events: StackEvent[] = [];

        const onEvent = (event: StackEvent): void => {
            events.push(event);
        };

        const initialState = {
            index: 2,
            routes: [
                { name: "Home" as const },
                { name: "Details" as const, params: { id: "3" } },
                { name: "Settings" as const },
            ],
        };

        await renderStack({ isAnimated: true, container: { initialState }, spies: { onEvent } });
        await screen.findByText("Settings Content");
        expect(events.filter(({ type }) => type.startsWith("transition"))).toEqual([]);
        events.length = 0;
        await popToPage(getNavigationView("Settings Content"), 0);
        await screen.findByText("Home Content");

        await waitFor(() => {
            expectHidden("Settings Content");
        });

        expect(events).toContainEqual({ type: "transitionStart", route: "Home", isClosing: false });
        expect(events).toContainEqual({ type: "transitionEnd", route: "Home", isClosing: false });
    });
});

describe("stack - events (reset)", () => {
    it("does not reveal an intermediate route", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const events: StackEvent[] = [];

        const onEvent = (event: StackEvent): void => {
            events.push(event);
        };

        await renderStack({ isAnimated: true, container: { ref }, spies: { onEvent } });
        await screen.findByText("Home Content");
        events.length = 0;

        await act(async () => {
            ref.resetRoot({
                index: 2,
                routes: [
                    { name: "Home" },
                    { name: "Details", params: { id: "8" } },
                    { name: "Settings" },
                ],
            });

            await Promise.resolve();
        });

        await screen.findByText("Settings Content");

        expect(events.filter(({ route, type }) =>
            route === "Details" && type.startsWith("transition"))).toEqual([]);
    });
});

describe("stack - events (native prevention)", () => {
    it("reports a prevented Alt+Left attempt without leaving the page", async () => {
        let preventions = 0;

        const onPrevent = (): void => {
            preventions += 1;
        };

        await renderStack({ spies: { onPrevent } });
        await clickButton("Go to compose");
        await screen.findByText("Compose Content");
        await pressKeys("Compose Content", "{Alt>}{ArrowLeft}{/Alt}");

        await waitFor(() => {
            expect(preventions).toBe(1);
            expectVisible("Compose Content");
        });

        expectHidden("Home Content");
    });
});
