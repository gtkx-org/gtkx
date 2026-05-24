import type { ListItem } from "@gtkx/react";
import { GtkListView } from "@gtkx/react";
import { act, render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

function App({ items }: { items: ListItem<string>[] }) {
    return (
        <ScrollWrapper>
            <GtkListView items={items} renderItem={() => "Item"} />
        </ScrollWrapper>
    );
}

describe("ListView performance", () => {
    it("filters 10k items to 2 in under 4s", async () => {
        const n = 10_000;
        const items: ListItem<string>[] = Array.from({ length: n }, (_, i) => ({ id: `w-${i}`, value: `w-${i}` }));
        const few = items.slice(0, 2);

        const { rerender } = await render(<App items={items} />);
        await act(() => {});

        const start = performance.now();
        await rerender(<App items={few} />);
        await act(() => {});
        const elapsed = performance.now() - start;

        console.log(`Filter ${n} → ${few.length}: ${elapsed.toFixed(0)}ms`);
        expect(elapsed).toBeLessThan(4000);
    });
});
