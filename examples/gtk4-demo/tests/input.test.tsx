import { getInterface } from "@gtkx/ffi";
import { AccessibleRole, Editable, type Entry, InputPurpose } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent, waitFor } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { entryDemo } from "../src/demos/input/entry.js";
import { passwordEntryDemo } from "../src/demos/input/password-entry.js";
import { scaleDemo } from "../src/demos/input/scale.js";
import { searchEntryDemo } from "../src/demos/input/search-entry.js";
import { spinButtonDemo } from "../src/demos/input/spin-button.js";

describe("Input Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("entry demo", () => {
        const EntryDemo = entryDemo.component;

        it("renders entry title", async () => {
            await render(<EntryDemo />);

            const title = await screen.findByText("Entry");
            expect(title).toBeDefined();
        });

        it("renders basic entry with placeholder", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const basicEntry = entries.find((e) => {
                const entry = e as Entry;
                return entry.getPlaceholderText() === "Type something...";
            }) as Entry | undefined;

            expect(basicEntry).toBeDefined();
        });

        it("renders entry with max length", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const maxLengthEntry = entries.find((e) => {
                const entry = e as Entry;
                return entry.getMaxLength() === 10;
            }) as Entry | undefined;

            expect(maxLengthEntry).toBeDefined();
        });

        it("renders entries with different input purposes", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const purposes = entries.map((e) => (e as Entry).getInputPurpose());

            expect(purposes).toContain(InputPurpose.EMAIL);
            expect(purposes).toContain(InputPurpose.PHONE);
            expect(purposes).toContain(InputPurpose.URL);
            expect(purposes).toContain(InputPurpose.NUMBER);
        });

        it("has a disabled entry", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const disabledEntry = entries.find((e) => !e.getSensitive()) as Entry | undefined;

            if (!disabledEntry) throw new Error("Disabled entry not found");

            expect(getInterface(disabledEntry, Editable)?.getText()).toBe("Cannot edit this");
        });

        it("allows typing in entries", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const basicEntry = entries.find((e) => {
                const entry = e as Entry;
                return entry.getPlaceholderText() === "Type something..." && e.getSensitive();
            }) as Entry | undefined;

            if (!basicEntry) throw new Error("Basic entry not found");

            await userEvent.type(basicEntry, "Hello World");

            await waitFor(() => {
                const text = getInterface(basicEntry, Editable)?.getText();
                if (text !== "Hello World") throw new Error(`Expected "Hello World", got "${text}"`);
            });
        });

        it("enforces max length on entry", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const maxLengthEntry = entries.find((e) => {
                const entry = e as Entry;
                return entry.getMaxLength() === 10;
            }) as Entry | undefined;

            if (!maxLengthEntry) throw new Error("Max length entry not found");

            await userEvent.type(maxLengthEntry, "This is a very long text");

            await waitFor(() => {
                const text = getInterface(maxLengthEntry, Editable)?.getText() ?? "";
                expect(text.length).toBeLessThanOrEqual(10);
            });
        });

        it("clears entry content", async () => {
            await render(<EntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            const basicEntry = entries.find((e) => {
                const entry = e as Entry;
                return entry.getPlaceholderText() === "Type something..." && e.getSensitive();
            }) as Entry | undefined;

            if (!basicEntry) throw new Error("Basic entry not found");

            await userEvent.type(basicEntry, "Test");
            await userEvent.clear(basicEntry);

            await waitFor(() => {
                const text = getInterface(basicEntry, Editable)?.getText();
                expect(text).toBe("");
            });
        });
    });

    describe("password entry demo", () => {
        const PasswordEntryDemo = passwordEntryDemo.component;

        it("renders password entry title", async () => {
            await render(<PasswordEntryDemo />);

            const title = await screen.findByText("Password Entry");
            expect(title).toBeDefined();
        });

        it("renders password entry fields", async () => {
            await render(<PasswordEntryDemo />);

            const entries = await screen.findAllByRole(AccessibleRole.TEXT_BOX);
            expect(entries.length).toBeGreaterThan(0);
        });
    });

    describe("search entry demo", () => {
        const SearchEntryDemo = searchEntryDemo.component;

        it("renders search entry title", async () => {
            await render(<SearchEntryDemo />);

            const title = await screen.findByText("Search Entry");
            expect(title).toBeDefined();
        });

        it("renders search entry", async () => {
            await render(<SearchEntryDemo />);

            const searchEntry = await screen.findByRole(AccessibleRole.SEARCH_BOX);
            expect(searchEntry).toBeDefined();
        });
    });

    describe("spin button demo", () => {
        const SpinButtonDemo = spinButtonDemo.component;

        it("renders spin button title", async () => {
            await render(<SpinButtonDemo />);

            const title = await screen.findByText("Spin Button");
            expect(title).toBeDefined();
        });

        it("renders multiple spin buttons", async () => {
            await render(<SpinButtonDemo />);

            const spinButtons = await screen.findAllByRole(AccessibleRole.SPIN_BUTTON);
            expect(spinButtons.length).toBeGreaterThanOrEqual(3);
        });

        it("shows initial integer value", async () => {
            await render(<SpinButtonDemo />);

            const valueLabel = await screen.findByText("Value: 50");
            expect(valueLabel).toBeDefined();
        });

        it("shows initial floating point value", async () => {
            await render(<SpinButtonDemo />);

            const valueLabel = await screen.findByText("Value: 3.14");
            expect(valueLabel).toBeDefined();
        });

        it("shows initial price value", async () => {
            await render(<SpinButtonDemo />);

            const valueLabel = await screen.findByText("Total: $9.99");
            expect(valueLabel).toBeDefined();
        });
    });

    describe("scale demo", () => {
        const ScaleDemo = scaleDemo.component;

        it("renders scale title", async () => {
            await render(<ScaleDemo />);

            const title = await screen.findByText("Scale");
            expect(title).toBeDefined();
        });

        it("renders scale sections", async () => {
            await render(<ScaleDemo />);

            const horizontalLabel = await screen.findByText("Horizontal Scale with Value");
            const marksLabel = await screen.findByText("Scale with Marks");
            const verticalLabel = await screen.findByText("Vertical Scale");

            expect(horizontalLabel).toBeDefined();
            expect(marksLabel).toBeDefined();
            expect(verticalLabel).toBeDefined();
        });

        it("shows initial volume value", async () => {
            await render(<ScaleDemo />);

            const volumeLabel = await screen.findByText("Current volume: 50%");
            expect(volumeLabel).toBeDefined();
        });

        it("shows initial brightness value", async () => {
            await render(<ScaleDemo />);

            const brightnessLabel = await screen.findByText("Current brightness: 75%");
            expect(brightnessLabel).toBeDefined();
        });

        it("shows initial temperature value", async () => {
            await render(<ScaleDemo />);

            const tempLabel = await screen.findByText("Temperature: 20.0°C");
            expect(tempLabel).toBeDefined();
        });
    });
});
