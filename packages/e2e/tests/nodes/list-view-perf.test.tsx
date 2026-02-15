import { GtkListView, GtkScrolledWindow, x } from "@gtkx/react";
import { render, tick } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

const ScrollWrapper = ({ children }: { children: React.ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

function App({ items }: { items: string[] }) {
    return (
        <ScrollWrapper>
            <GtkListView renderItem={() => "Item"}>
                {items.map((id) => (
                    <x.ListItem key={id} id={id} value={id} />
                ))}
            </GtkListView>
        </ScrollWrapper>
    );
}

describe("ListView performance", () => {
    it("filters 10k items to 2 in under 4s", { timeout: 30_000 }, async () => {
        const n = 10_000;
        const items = Array.from({ length: n }, (_, i) => `w-${i}`);
        const few = items.slice(0, 2);

        const { rerender } = await render(<App items={items} />);
        await tick();

        const start = performance.now();
        await rerender(<App items={few} />);
        await tick();
        const elapsed = performance.now() - start;

        console.log(`Filter ${n} → ${few.length}: ${elapsed.toFixed(0)}ms`);
        expect(elapsed).toBeLessThan(4000);
    });
});
