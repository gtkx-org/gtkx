import { GtkColumnView, GtkColumnViewColumn, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Person = { name: string; salary: number };

const PEOPLE: Person[] = Array.from({ length: 3 }, (_, index) => ({ name: `P${index}`, salary: index * 10 }));

const view = (withMiddleColumn: boolean): ReactElement => (
    <GtkScrolledWindow minContentHeight={300} minContentWidth={400}>
        <GtkColumnView items={PEOPLE.map((person) => ({ id: person.name, value: person }))}>
            <GtkColumnViewColumn
                id="name"
                title="Name"
                expand
                renderCell={(item: Person) => <GtkLabel label={item.name} />}
            />
            {withMiddleColumn ? (
                <GtkColumnViewColumn
                    id="extra"
                    title="Extra"
                    expand
                    renderCell={(item: Person) => <GtkLabel label={`x-${item.name}`} />}
                />
            ) : null}
            <GtkColumnViewColumn
                id="salary"
                title="Salary"
                expand
                renderCell={(item: Person) => <GtkLabel label={String(item.salary)} />}
            />
        </GtkColumnView>
    </GtkScrolledWindow>
);

const drainPendingTasks = async (): Promise<void> => {
    for (let round = 0; round < 5; round++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
};

const actWarnings = (errorSpy: { mock: { calls: unknown[][] } }): string[] =>
    errorSpy.mock.calls.map((args) => args.map(String).join(" ")).filter((text) => text.includes("not wrapped in act"));

afterEach(() => {
    vi.restoreAllMocks();
});

describe("act safety", () => {
    it("keeps deferred bound-item flushes inside act when column structure changes", async () => {
        const errorSpy = vi.spyOn(console, "error");

        const { rerender } = await render(view(false));
        await rerender(view(true));
        await drainPendingTasks();

        expect(actWarnings(errorSpy)).toEqual([]);
    });

    it("keeps deferred bound-item flushes inside act when a cell renderer changes identity", async () => {
        const errorSpy = vi.spyOn(console, "error");

        const { rerender } = await render(view(true));
        await rerender(view(true));
        await drainPendingTasks();

        expect(actWarnings(errorSpy)).toEqual([]);
    });
});
