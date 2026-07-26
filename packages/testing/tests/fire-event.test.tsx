import { describe, expect, it } from "vitest";
import { fireEvent } from "../src/index.js";
import { renderClickButton } from "./event-render-setup.js";

describe("fireEvent", () => {
    it("emits clicked signal on button", async () => {
        const { handleClick, button } = await renderClickButton();
        await fireEvent(button, "clicked");
        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("emits multiple signals in sequence", async () => {
        const { handleClick, button } = await renderClickButton();
        await fireEvent(button, "clicked");
        await fireEvent(button, "clicked");
        await fireEvent(button, "clicked");
        expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it("returns a promise that resolves after signal emission", async () => {
        const { handleClick, button } = await renderClickButton();
        const promise = fireEvent(button, "clicked");
        expect(promise).toBeInstanceOf(Promise);
        await promise;
        expect(handleClick).toHaveBeenCalled();
    });
});
