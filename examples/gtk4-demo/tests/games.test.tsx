import { AccessibleRole, type Button } from "@gtkx/ffi/gtk";
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import { afterEach, describe, expect, it } from "vitest";
import { fifteenPuzzleDemo } from "../src/demos/games/fifteen-puzzle.js";
import { memoryGameDemo } from "../src/demos/games/memory-game.js";

describe("Games Demos", () => {
    afterEach(async () => {
        await cleanup();
    });

    describe("fifteen puzzle demo", () => {
        const FifteenPuzzleDemo = fifteenPuzzleDemo.component;

        it("renders puzzle title", async () => {
            await render(<FifteenPuzzleDemo />);

            const title = await screen.findByText("15 Puzzle");
            expect(title).toBeDefined();
        });

        it("shows initial moves counter at 0", async () => {
            await render(<FifteenPuzzleDemo />);

            const movesLabel = await screen.findByText("Moves: 0");
            expect(movesLabel).toBeDefined();
        });

        it("renders game instructions", async () => {
            await render(<FifteenPuzzleDemo />);

            const instructions = await screen.findByText(/Slide the tiles to arrange them in numerical order/);
            expect(instructions).toBeDefined();
        });

        it("has new game button", async () => {
            await render(<FifteenPuzzleDemo />);

            const newGameBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "New Game" });
            expect(newGameBtn).toBeDefined();
        });

        it("renders 16 tile buttons (15 numbered + 1 empty)", async () => {
            await render(<FifteenPuzzleDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const tileButtons = buttons.filter((btn) => {
                const label = (btn as Button).getLabel();
                return label === "" || (Number(label) >= 1 && Number(label) <= 15);
            });

            expect(tileButtons.length).toBe(16);
        });

        it("increments moves when clicking a movable tile", async () => {
            await render(<FifteenPuzzleDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const movableTiles = buttons.filter((btn) => {
                const label = (btn as Button).getLabel();
                const isNumbered = Number(label) >= 1 && Number(label) <= 15;
                return isNumbered && btn.getSensitive();
            });

            if (movableTiles.length === 0) throw new Error("No movable tiles found");

            const firstMovable = movableTiles[0];
            if (!firstMovable) throw new Error("First movable tile not found");

            await userEvent.click(firstMovable);

            const movesLabel = await screen.findByText("Moves: 1");
            expect(movesLabel).toBeDefined();
        });

        it("resets game when clicking new game", async () => {
            await render(<FifteenPuzzleDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const movableTiles = buttons.filter((btn) => {
                const label = (btn as Button).getLabel();
                const isNumbered = Number(label) >= 1 && Number(label) <= 15;
                return isNumbered && btn.getSensitive();
            });

            if (movableTiles.length > 0) {
                const firstMovable = movableTiles[0];
                if (firstMovable) {
                    await userEvent.click(firstMovable);
                }
            }

            const newGameBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "New Game" });
            await userEvent.click(newGameBtn);

            const movesLabel = await screen.findByText("Moves: 0");
            expect(movesLabel).toBeDefined();
        });
    });

    describe("memory game demo", () => {
        const MemoryGameDemo = memoryGameDemo.component;

        it("renders memory game title", async () => {
            await render(<MemoryGameDemo />);

            const title = await screen.findByText("Memory Game");
            expect(title).toBeDefined();
        });

        it("shows initial moves counter at 0", async () => {
            await render(<MemoryGameDemo />);

            const movesLabel = await screen.findByText("Moves: 0");
            expect(movesLabel).toBeDefined();
        });

        it("shows initial matches counter at 0/8", async () => {
            await render(<MemoryGameDemo />);

            const matchesLabel = await screen.findByText("Matches: 0/8");
            expect(matchesLabel).toBeDefined();
        });

        it("renders game instructions", async () => {
            await render(<MemoryGameDemo />);

            const instructions = await screen.findByText(/Find all matching pairs!/);
            expect(instructions).toBeDefined();
        });

        it("has new game button", async () => {
            await render(<MemoryGameDemo />);

            const newGameBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "New Game" });
            expect(newGameBtn).toBeDefined();
        });

        it("renders 16 card buttons", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const cardButtons = buttons.filter((btn) => {
                const label = (btn as Button).getLabel();
                return label === "?" || (label && label.length === 1 && label >= "A" && label <= "H");
            });

            expect(cardButtons.length).toBe(16);
        });

        it("all cards initially show question mark", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            expect(hiddenCards.length).toBe(16);
        });

        it("flips card and increments moves on click", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            if (hiddenCards.length === 0) throw new Error("No hidden cards found");

            const firstCard = hiddenCards[0];
            if (!firstCard) throw new Error("First card not found");

            await userEvent.click(firstCard);

            const movesLabel = await screen.findByText("Moves: 1");
            expect(movesLabel).toBeDefined();

            const flippedCard = (firstCard as Button).getLabel();
            expect(flippedCard).not.toBe("?");
        });

        it("resets game when clicking new game", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            if (hiddenCards.length > 0) {
                const firstCard = hiddenCards[0];
                if (firstCard) {
                    await userEvent.click(firstCard);
                }
            }

            const newGameBtn = await screen.findByRole(AccessibleRole.BUTTON, { name: "New Game" });
            await userEvent.click(newGameBtn);

            const movesLabel = await screen.findByText("Moves: 0");
            const matchesLabel = await screen.findByText("Matches: 0/8");

            expect(movesLabel).toBeDefined();
            expect(matchesLabel).toBeDefined();
        });

        it("can flip two cards sequentially", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            if (hiddenCards.length < 2) throw new Error("Not enough hidden cards");

            const firstCard = hiddenCards[0];
            const secondCard = hiddenCards[1];

            if (!firstCard || !secondCard) throw new Error("Cards not found");

            await userEvent.click(firstCard);
            await userEvent.click(secondCard);

            const movesLabel = await screen.findByText("Moves: 2");
            expect(movesLabel).toBeDefined();
        });

        it("reveals symbol when card is clicked", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            if (hiddenCards.length === 0) throw new Error("No hidden cards found");

            const firstCard = hiddenCards[0];
            if (!firstCard) throw new Error("First card not found");

            await userEvent.click(firstCard);

            const label = (firstCard as Button).getLabel();
            expect(label).toMatch(/^[A-H]$/);
        });

        it("cannot click already flipped card", async () => {
            await render(<MemoryGameDemo />);

            const buttons = await screen.findAllByRole(AccessibleRole.BUTTON);
            const hiddenCards = buttons.filter((btn) => (btn as Button).getLabel() === "?");

            if (hiddenCards.length === 0) throw new Error("No hidden cards found");

            const firstCard = hiddenCards[0];
            if (!firstCard) throw new Error("First card not found");

            await userEvent.click(firstCard);

            expect(firstCard.getSensitive()).toBe(false);
        });
    });
});
