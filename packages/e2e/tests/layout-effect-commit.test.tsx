import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { isInCommit, scheduleCommitWork } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef, useLayoutEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const flushTasks = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("layout effects during commit", () => {
    it("reads and writes a widget imperatively from a layout effect", async () => {
        const labelRef = createRef<Gtk.Label>();

        const Probe = () => {
            useLayoutEffect(() => {
                const label = labelRef.current;
                if (!label) throw new Error("expected the committed label ref");
                label.setLabel(`${label.getLabel()}-adjusted`);
            }, []);
            return <GtkLabel ref={labelRef} label="committed" />;
        };

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <Probe />
            </GtkBox>,
        );

        expect(labelRef.current?.getLabel()).toBe("committed-adjusted");
    });

    it("keeps signals flowing after a layout effect spawns a synchronous re-render", async () => {
        const onClicked = vi.fn();

        const Trigger = () => {
            const [armed, setArmed] = useState(false);
            useLayoutEffect(() => {
                setArmed(true);
            }, []);
            return <GtkButton label={armed ? "armed" : "idle"} onClicked={onClicked} />;
        };

        await render(<Trigger />);
        await userEvent.click(await screen.findByText("armed"));

        expect(onClicked).toHaveBeenCalledTimes(1);
    });
});

describe("scheduleCommitWork", () => {
    it("runs scheduled work in the freeze window, before a layout-effect microtask", async () => {
        const order: string[] = [];

        const Probe = () => {
            useLayoutEffect(() => {
                expect(isInCommit()).toBe(true);
                scheduleCommitWork(() => order.push("commit-work"));
                queueMicrotask(() => order.push("microtask"));
            }, []);
            return <GtkLabel label="probe" />;
        };

        await render(<Probe />);
        await flushTasks();

        expect(order).toEqual(["commit-work", "microtask"]);
    });

    it("coalesces repeated schedules of the same callback within one commit", async () => {
        let runs = 0;
        const work = (): void => {
            runs += 1;
        };

        const Probe = () => {
            useLayoutEffect(() => {
                scheduleCommitWork(work);
                scheduleCommitWork(work);
                scheduleCommitWork(work);
            }, []);
            return <GtkLabel label="probe" />;
        };

        await render(<Probe />);
        await flushTasks();

        expect(runs).toBe(1);
    });

    it("defers to a microtask and reports no commit outside the reconciler", async () => {
        const calls: string[] = [];

        expect(isInCommit()).toBe(false);
        scheduleCommitWork(() => calls.push("deferred"));
        expect(calls).toEqual([]);

        await flushTasks();

        expect(calls).toEqual(["deferred"]);
    });
});
