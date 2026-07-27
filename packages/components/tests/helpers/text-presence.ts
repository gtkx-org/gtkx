import { screen } from "@gtkx/testing";
import { expect } from "vitest";

const expectTextPresent = async (text: string): Promise<void> => {
    const matches = await screen.findAllByText(text);
    expect(matches.length).toBeGreaterThan(0);
};

export { expectTextPresent };
