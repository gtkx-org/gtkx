import type * as Gtk from "@gtkx/gi/gtk";
import type { CaughtErrorInfo, Root, RootOptions } from "@gtkx/react";
import type { ReactNode, RefObject } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, rootElement } from "@gtkx/react";
import { act, waitFor } from "@gtkx/testing";
import { Component, createRef, useId } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type LabelProps = { labelRef: RefObject<Gtk.Label | null> };
type BoundaryProps = LabelProps & { children: ReactNode };
type BoundaryState = { hasFailed: boolean };
type CaughtRecord = { boundary: CaughtErrorInfo["errorBoundary"]; count: number };

const mounted: Root[] = [];
const flaky = { attempts: 0 };

const countFlakyAttempt = (): number => {
    flaky.attempts += 1;

    return flaky.attempts;
};

const Identified = ({ labelRef }: LabelProps): ReactNode => <GtkLabel ref={labelRef} label={useId()} />;

const Exploding = (): ReactNode => {
    throw new Error("render exploded");
};

const Flaky = ({ labelRef }: LabelProps): ReactNode => {
    if (countFlakyAttempt() === 1) {
        throw new Error("first render exploded");
    }

    return <GtkLabel ref={labelRef}>recovered</GtkLabel>;
};

class Boundary extends Component<BoundaryProps, BoundaryState> {
    static getDerivedStateFromError(): BoundaryState {
        return { hasFailed: true };
    }

    override state: BoundaryState = { hasFailed: false };

    override render(): ReactNode {
        return this.state.hasFailed ? <GtkLabel ref={this.props.labelRef}>recovered</GtkLabel> : this.props.children;
    }
}

const openRoot = (options?: RootOptions): Root => {
    const root = createRoot({ ...rootElement }, options);
    mounted.push(root);

    return root;
};

const renderIdentifier = async (options?: RootOptions): Promise<string | undefined> => {
    const labelRef = createRef<Gtk.Label>();
    const root = openRoot(options);

    await act(() => {
        root.render(<Identified labelRef={labelRef} />);
    });

    return labelRef.current?.getLabel();
};

const renderBoundary = async (options?: RootOptions): Promise<string | undefined> => {
    const labelRef = createRef<Gtk.Label>();
    const root = openRoot(options);

    await act(() => {
        root.render(
            <Boundary labelRef={labelRef}>
                <Exploding />
            </Boundary>,
        );
    });

    return labelRef.current?.getLabel();
};

const renderRecovering = async (options?: RootOptions): Promise<string | undefined> => {
    const labelRef = createRef<Gtk.Label>();
    const root = openRoot(options);
    flaky.attempts = 0;

    await act(() => {
        root.render(<Flaky labelRef={labelRef} />);
    });

    return labelRef.current?.getLabel();
};

afterEach(async () => {
    const roots = [...mounted];
    mounted.length = 0;

    for (const root of roots) {
        await act(() => {
            root.unmount();
        });
    }
});

describe("createRoot options", () => {
    it("gives useId the identifier prefix the root was created with", async () => {
        expect(await renderIdentifier({ identifierPrefix: "gtkx" })).toContain("gtkx");
    });

    it("gives every useId call under one root a distinct identifier", async () => {
        const first = await renderIdentifier({ identifierPrefix: "gtkx" });
        const second = await renderIdentifier({ identifierPrefix: "gtkx" });

        expect(first).toBeTruthy();
        expect(second).toBeTruthy();
        expect(first).not.toBe(second);
    });

    it("leaves useId unprefixed when no options are given", async () => {
        const identifier = await renderIdentifier();

        expect(identifier).toBeTruthy();
        expect(identifier).not.toContain("gtkx");
    });

    it("keeps the default container working when only options are given", async () => {
        const labelRef = createRef<Gtk.Label>();
        const root = createRoot(rootElement, { identifierPrefix: "defaulted" });
        mounted.push(root);

        await act(() => {
            root.render(<Identified labelRef={labelRef} />);
        });

        expect(labelRef.current?.getLabel()).toContain("defaulted");
    });

    it("hands an error an error boundary caught to onCaughtError with the boundary", async () => {
        const caught: CaughtRecord = { boundary: null, count: 0 };

        const onCaughtError = (_error: unknown, errorInfo: CaughtErrorInfo): void => {
            caught.boundary = errorInfo.errorBoundary;
            caught.count += 1;
        };

        expect(await renderBoundary({ identifierPrefix: "caught", onCaughtError })).toBe("recovered");
        expect(caught.count).toBe(1);
        expect(caught.boundary).toBeInstanceOf(Boundary);
    });

    it("still recovers through the boundary when no callbacks are given", async () => {
        expect(await renderBoundary()).toBe("recovered");
    });

    it("hands an error React recovered from to onRecoverableError", async () => {
        const onRecoverableError = vi.fn();

        expect(await renderRecovering({ onRecoverableError })).toBe("recovered");
        expect(onRecoverableError).toHaveBeenCalledTimes(1);
    });

    it("still commits the retried tree when no callbacks are given", async () => {
        expect(await renderRecovering()).toBe("recovered");
    });

    it("hands an uncaught render error to onUncaughtError instead of rethrowing it", async () => {
        const onUncaughtError = vi.fn();
        const root = openRoot({ onUncaughtError });

        root.render(<Exploding />);

        await waitFor(() => {
            expect(onUncaughtError).toHaveBeenCalledTimes(1);
        });
    });
});
