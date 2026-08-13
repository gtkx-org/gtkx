import { screen } from "@gtkx/testing";
import { expect } from "vitest";

const expectTextPresent = async (text: string): Promise<void> => {
    const matches = await screen.findAllByText(text);

    for (const match of matches) {
        expect(match).toBeVisible();
    }
};

export { expectTextPresent };
