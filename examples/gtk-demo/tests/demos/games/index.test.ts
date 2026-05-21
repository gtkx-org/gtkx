import { describe, expect, it } from "vitest";
import { gamesDemos } from "../../../src/demos/games/index.js";

describe("gamesDemos", () => {
    it("exposes the expected games demos", () => {
        expect(gamesDemos.map((d) => d.id)).toEqual(["listview-minesweeper"]);
    });
});
