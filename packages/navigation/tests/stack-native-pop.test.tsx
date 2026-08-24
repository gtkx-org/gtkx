import { createNavigationContainerRef } from "@gtkx/navigation";
import { act, screen, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    clickButton,
    countPages,
    createEventSpy,
    createPreventSpy,
    createStateSpy,
    expectHidden,
    expectRouteNames,
    expectVisible,
    getNavigationView,
    popToPage,
    renderStack,
    type RootParams,
    type StackEvent,
} from "./helpers/stack-fixtures.js";

describe("stack - native pop (1)", () => {
    it("animates the page out instead of dropping it when Back is clicked", async () => {
        await renderStack({ isAnimated: true });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        await clickButton("Back");
        expectVisible("Details 1");

        await waitFor(() => {
            expectHidden("Details 1");
        });

        expectVisible("Home Content");
    });

    it("reports the transition of the page it pops", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        onEvent.mockClear();
        await clickButton("Back");

        await waitFor(() => {
            expect(onEvent.mock.calls.flat()).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });

    it("reports the transition of a page popped from a screen", async () => {
        const onEvent = createEventSpy();
        await renderStack({ isAnimated: true, spies: { onEvent } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");
        onEvent.mockClear();
        await clickButton("Go back");

        await waitFor(() => {
            expect(onEvent.mock.calls.flat()).toContainEqual({
                type: "transitionEnd",
                route: "Details",
                isClosing: true,
            });
        });
    });
});

describe("stack - native pop (2)", () => {
    it("keeps the page when the prevent callback changes the route params", async () => {
        const onPrevent = createPreventSpy();
        const onStateChange = createStateSpy();
        await renderStack({ isAnimated: true, spies: { onPrevent }, container: { onStateChange } });
        await clickButton("Go to draft");
        await screen.findByText("Draft empty");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Draft unsaved");
        });

        expect(onPrevent).toHaveBeenCalledTimes(1);
        expectRouteNames(onStateChange, ["Home", "Draft"]);
    });

    it("restores the pages when a multi-page pop is prevented", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Push compose");
        await screen.findByText("Compose Content");
        const view = getNavigationView("Compose Content");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Compose Content");
        });

        expectRouteNames(onStateChange, ["Home", "Details", "Compose"]);
    });

    it("follows the stack when the user pops several pages at once", async () => {
        const onStateChange = createStateSpy();
        await renderStack({ container: { onStateChange } });
        await clickButton("Go to details");
        await clickButton("Push details");
        await screen.findByText("Details 2");
        const view = getNavigationView("Details 2");
        await popToPage(view, 0);

        await waitFor(() => {
            expectVisible("Home Content");
        });

        expectRouteNames(onStateChange, ["Home"]);
    });
});

describe("stack - native pop (leak)", () => {
    it("drops each popped page instead of keeping it mounted", async () => {
        await renderStack();
        const view = getNavigationView("Home Content");

        for (let cycle = 0; cycle < 3; cycle += 1) {
            await clickButton("Go to details");
            await screen.findByText("Details 1");
            await clickButton("Back");
            await screen.findByText("Home Content");
        }

        expect(countPages(view)).toBe(1);
    });
});

describe("stack - native pop (race)", () => {
    it("preserves navigation dispatched from the closing transitionEnd listener", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        let didNavigate = false;

        const onEvent = (event: StackEvent): void => {
            if (didNavigate || event.route !== "Details" ||
                event.type !== "transitionEnd" || event.isClosing !== true) {
                return;
            }

            didNavigate = true;
            ref.navigate("Settings");
        };

        await renderStack({ isAnimated: true, container: { ref }, spies: { onEvent } });
        await clickButton("Go to details");
        await screen.findByText("Details 1");

        await waitFor(() => {
            expectHidden("Home Content");
        });

        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Settings Content");
            expectHidden("Details 1");
            expect(ref.getRootState()?.routes.map((route) => route.name)).toEqual(["Home", "Settings"]);
        });

        expect(didNavigate).toBe(true);
    });
});

describe("stack - native pop (prevent navigation)", () => {
    it("keeps later transition events after prevention navigates elsewhere", async () => {
        const ref = createNavigationContainerRef<RootParams>();
        const events: StackEvent[] = [];

        const onEvent = (event: StackEvent): void => {
            events.push(event);
        };

        const onPrevent = (): void => {
            ref.navigate("Settings");
        };

        await renderStack({ isAnimated: true, container: { ref }, spies: { onEvent, onPrevent } });
        await clickButton("Go to compose");
        await screen.findByText("Compose Content");
        await clickButton("Back");

        await waitFor(() => {
            expectVisible("Settings Content");
            expectHidden("Compose Content");
        });

        events.length = 0;
        await clickButton("Back");

        await waitFor(() => {
            expect(events).toContainEqual({
                type: "transitionEnd",
                route: "Settings",
                isClosing: true,
            });
        });
    });
});

describe("stack - native pop (interrupted reconciliation)", () => {
    it("releases a popped page when navigation removes its route before reconciliation", async () => {
        const ref = createNavigationContainerRef<RootParams>();

        const initialState = {
            index: 2,
            routes: [
                { name: "Home" as const },
                { name: "Compose" as const },
                { name: "Settings" as const },
            ],
        };

        await renderStack({ container: { initialState, ref } });
        await screen.findByText("Settings Content");
        const view = getNavigationView("Settings Content");
        expect(countPages(view)).toBe(3);

        await act(async () => {
            view.pop();
            ref.goBack();
            await Promise.resolve();
        });

        await waitFor(() => {
            expectVisible("Compose Content");
            expectHidden("Settings Content");
            expect(ref.getRootState()?.routes.map((route) => route.name)).toEqual(["Home", "Compose"]);
            expect(countPages(view)).toBe(2);
        });
    });
});
