import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { ScrollWrapper } from "./scroll-wrapper.js";

/**
 * Builds a scrollable box of `n` buttons, each carrying a fresh `onClicked`
 * closure identity on every call — the inline-handler pattern idiomatic
 * React code produces on every render. Rebuilding the tree per call hands
 * the reconciler fresh element objects, so a rerender diffs every button.
 *
 * @param n - Number of buttons in the box.
 * @returns The scroll-wrapped button subtree.
 */
export const drawButtonBox = (n: number): ReactNode => (
    <ScrollWrapper>
        <GtkBox>
            {Array.from({ length: n }, (_, i) => `button-${i}`).map((name) => (
                <GtkButton key={name} label={name} onClicked={() => undefined} />
            ))}
        </GtkBox>
    </ScrollWrapper>
);
