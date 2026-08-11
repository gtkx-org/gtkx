import * as Gdk from "@gtkx/gi/gdk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit, type Root, type RootElement, rootElement } from "@gtkx/react";
import { act } from "@gtkx/testing";
import { type ReactNode, useEffect } from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

type ProbeProps = { onCleanup: () => void };

type ProbeRoot = {
    root: Root;
    onCleanup: Mock;
    mount: () => Promise<void>;
};

type Teardown = {
    name: string;
    tearDown: (root: Root) => void;
};

const TEARDOWNS: Teardown[] = [
    {
        name: "unmount",
        tearDown: (root) => {
            root.unmount();
        },
    },
    {
        name: "a render of null",
        tearDown: (root) => {
            root.render(null);
        },
    },
    {
        name: "a previous quit",
        tearDown: () => {
            quit();
        },
    },
];

const Probe = ({ onCleanup }: ProbeProps): ReactNode => {
    useEffect(() => onCleanup, [onCleanup]);

    return <GtkLabel>probe</GtkLabel>;
};

const createProbeRoot = (): ProbeRoot => {
    const container: RootElement = { ...rootElement };
    const root = createRoot(container);
    const onCleanup = vi.fn();

    return {
        root,
        onCleanup,
        mount: async () => {
            await act(() => {
                root.render(<Probe onCleanup={onCleanup} />);
            });
        },
    };
};

describe.each(TEARDOWNS)("quit after $name", (teardown) => {
    it("unmounts a root that was rendered again", async () => {
        const probe = createProbeRoot();
        await probe.mount();

        await act(() => {
            teardown.tearDown(probe.root);
        });

        expect(probe.onCleanup).toHaveBeenCalledTimes(1);
        await probe.mount();
        probe.onCleanup.mockClear();
        expect(await act(() => quit())).toBe(Gdk.EVENT_STOP);
        expect(probe.onCleanup).toHaveBeenCalledTimes(1);
    });
});

describe("quit", () => {
    it("lets the originating signal propagate when nothing is mounted", async () => {
        const probe = createProbeRoot();
        await probe.mount();
        expect(await act(() => quit())).toBe(Gdk.EVENT_STOP);
        expect(await act(() => quit())).toBe(Gdk.EVENT_PROPAGATE);
    });
});
