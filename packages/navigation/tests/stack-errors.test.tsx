import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Stack } from "./helpers/stack-fixtures.js";

const Page = (): ReactNode => <GtkLabel>Page Content</GtkLabel>;

describe("stack - error paths", () => {
    it("throws when a navigator renders outside a container", async () => {
        await expect(
            render(
                <Stack.Navigator>
                    <Stack.Screen name="Home" component={Page} />
                </Stack.Navigator>,
            ),
        ).rejects.toThrow();
    });
});
