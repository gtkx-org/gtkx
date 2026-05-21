import { describe, expect, it } from "vitest";
import { mediaDemos } from "../../../src/demos/media/index.js";

describe("mediaDemos", () => {
    it("exposes the expected media demos", () => {
        expect(mediaDemos.map((d) => d.id)).toEqual(["video-player"]);
    });
});
