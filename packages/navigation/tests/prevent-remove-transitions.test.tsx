import type { NavigationState } from "@gtkx/navigation";
import { createNavigationContainerRef } from "@gtkx/navigation";
import { screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton as clickSplitButton,
    expectHidden as expectSplitHidden,
    expectVisible as expectSplitVisible,
    pressKeys as pressSplitKeys,
    renderSplit,
    type SplitEvent,
} from "./helpers/split-view-fixtures.js";
import {
    clickButton as clickStackButton,
    expectHidden as expectStackHidden,
    expectVisible as expectStackVisible,
    getNavigationView,
    popToPage,
    pressKeys as pressStackKeys,
    renderStack,
    type RootParams,
    type StackEvent,
} from "./helpers/stack-fixtures.js";

type RemovalRecorder<Event> = {
    events: Event[];
    preventionCount: number;
    states: (NavigationState | undefined)[];
    onEvent: (event: Event) => void;
    onPrevent: () => void;
    onStateChange: (state: NavigationState | undefined) => void;
};

const createRemovalRecorder = <Event,>(): RemovalRecorder<Event> => {
    const recorder: RemovalRecorder<Event> = {
        events: [],
        preventionCount: 0,
        states: [],
        onEvent: (event) => {
            recorder.events.push(event);
        },
        onPrevent: () => {
            recorder.preventionCount += 1;
        },
        onStateChange: (state) => {
            recorder.states.push(state);
        },
    };

    return recorder;
};

const routeNames = (states: (NavigationState | undefined)[]): string[] =>
    states.at(-1)?.routes.map((route) => route.name) ?? [];

async function expectStackRemovalPrevented(recorder: RemovalRecorder<StackEvent>): Promise<void> {
    await waitFor(() => {
        expect(recorder.preventionCount).toBe(1);
        expectStackVisible("Compose Content");
        expectStackHidden("Home Content");
    });

    expect(routeNames(recorder.states)).toEqual(["Home", "Compose"]);
    expect(recorder.events).toEqual([]);
}

async function expectSplitRemovalPrevented(recorder: RemovalRecorder<SplitEvent>): Promise<void> {
    await waitFor(() => {
        expect(recorder.preventionCount).toBe(1);
        expectSplitVisible("Draft Content");
        expectSplitHidden("Lists Content");
    });

    expect(routeNames(recorder.states)).toEqual(["Lists", "Draft"]);
    expect(recorder.events).toEqual([]);
}

describe("preventing native stack removal", () => {
    it("keeps an animated stack route in place when Back is prevented", async () => {
        const recorder = createRemovalRecorder<StackEvent>();

        await renderStack({
            isAnimated: true,
            container: { onStateChange: recorder.onStateChange },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await clickStackButton("Go to compose");
        await screen.findByText("Compose Content");

        await waitFor(() => {
            expectStackHidden("Home Content");
        });

        recorder.events.length = 0;
        await clickStackButton("Back");
        await expectStackRemovalPrevented(recorder);
    });

    it("keeps an animated stack route in place when Escape is prevented", async () => {
        const recorder = createRemovalRecorder<StackEvent>();

        await renderStack({
            isAnimated: true,
            container: { onStateChange: recorder.onStateChange },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await clickStackButton("Go to compose");
        await screen.findByText("Compose Content");

        await waitFor(() => {
            expectStackHidden("Home Content");
        });

        recorder.events.length = 0;
        await pressStackKeys("Compose Content", "{Escape}");
        await expectStackRemovalPrevented(recorder);
    });
});

describe("preventing native stack multi-pop (1)", () => {
    it("silently restores a native multi-pop across a protected middle route", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const recorder = createRemovalRecorder<StackEvent>();

        const initialState = {
            index: 2,
            routes: [
                { name: "Home" as const },
                { name: "Compose" as const },
                { name: "Settings" as const },
            ],
        };

        await renderStack({
            isAnimated: true,
            container: { initialState, ref },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await screen.findByText("Settings Content");
        recorder.events.length = 0;
        await popToPage(getNavigationView("Settings Content"), 0);

        await waitFor(() => {
            expect(recorder.preventionCount).toBe(1);
            expectStackVisible("Settings Content");
            expectStackHidden("Home Content");
        });

        expect(ref.getRootState()?.routes.map((route) => route.name)).toEqual([
            "Home",
            "Compose",
            "Settings",
        ]);

        expect(recorder.events).toEqual([]);
    });
});

describe("preventing native stack multi-pop (2)", () => {
    it("reports an accepted immediate pop above a protected route", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const recorder = createRemovalRecorder<StackEvent>();

        await renderStack({
            container: {
                initialState: {
                    index: 1,
                    routes: [
                        { name: "Compose" },
                        { name: "Settings" },
                    ],
                },
                ref,
            },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await screen.findByText("Settings Content");
        recorder.events.length = 0;
        await clickStackButton("Back");

        await waitFor(() => {
            expectStackVisible("Compose Content");
            expectStackHidden("Settings Content");
        });

        expect(ref.getRootState()?.routes.map((route) => route.name)).toEqual(["Compose"]);
        expect(recorder.preventionCount).toBe(0);

        expect(recorder.events).toContainEqual({
            type: "transitionEnd",
            route: "Settings",
            isClosing: true,
        });
    });
});

describe("preventing native split-view removal", () => {
    it("keeps collapsed split content in place when Back is prevented", async () => {
        const recorder = createRemovalRecorder<SplitEvent>();

        await renderSplit({
            isAnimated: true,
            navigator: { collapsed: true },
            container: { onStateChange: recorder.onStateChange },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await clickSplitButton("Open draft");
        await screen.findByText("Draft Content");

        await waitFor(() => {
            expectSplitHidden("Lists Content");
        });

        recorder.events.length = 0;
        await clickSplitButton("Back");
        await expectSplitRemovalPrevented(recorder);
    });

    it("keeps collapsed split content in place when Escape is prevented", async () => {
        const recorder = createRemovalRecorder<SplitEvent>();

        await renderSplit({
            isAnimated: true,
            navigator: { collapsed: true },
            container: { onStateChange: recorder.onStateChange },
            spies: { onEvent: recorder.onEvent, onPrevent: recorder.onPrevent },
        });

        await clickSplitButton("Open draft");
        await screen.findByText("Draft Content");

        await waitFor(() => {
            expectSplitHidden("Lists Content");
        });

        recorder.events.length = 0;
        await pressSplitKeys("Draft Content", "{Escape}");
        await expectSplitRemovalPrevented(recorder);
    });
});
