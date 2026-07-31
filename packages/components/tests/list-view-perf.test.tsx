import { type ListItem, ListView } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

function App({ items }: { items: ListItem<string>[] }) {
    return (
        <ScrollWrapper>
            <ListView items={items} renderItem={() => <GtkLabel>Item</GtkLabel>} />
        </ScrollWrapper>
    );
}

describe("ListView performance", () => {
    it("filters 10k items to 2 in under 4s", async () => {
        const n = 10_000;

        const items: ListItem<string>[] = Array.from({ length: n }, (_, i) => ({
            id: `w-${String(i)}`,
            value: `w-${String(i)}`,
        }));

        const few = items.slice(0, 2);
        const { rerender } = await render(<App items={items} />);
        const start = performance.now();
        await rerender(<App items={few} />);
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(4000);
    });
});
