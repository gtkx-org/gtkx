import type { ReactNode } from "react";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkFrame,
    GtkImage,
    GtkLabel,
    GtkLevelBar,
    GtkProgressBar,
    GtkScale,
    GtkSeparator,
    GtkSpinner,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { cleanup, render } from "@gtkx/testing/internal";
import { bench, describe } from "vitest";
import { scrolledBox } from "../tests/helpers/scrolled-box.js";

type RowRenderer = (i: number, key: string) => ReactNode;

const SIZES = [98, 392];

const ROW_RENDERERS: RowRenderer[] = [
    (_i, key) => <GtkButton key={key} label={`b-${key}`} onClicked={(): void => undefined} />,
    (_i, key) => <GtkLabel key={key}>{`l-${key}`}</GtkLabel>,
    (i, key) => <GtkToggleButton key={key} label={`t-${key}`} active={i % 2 === 0} />,
    (i, key) => <GtkCheckButton key={key} label={`c-${key}`} active={i % 3 === 0} />,
    (i, key) => <GtkSwitch key={key} active={i % 2 === 0} />,
    (_i, key) => <GtkEntry key={key} text={`e-${key}`} />,
    (_i, key) => <GtkImage key={key} iconName="dialog-information" />,
    (i, key) => <GtkSpinner key={key} spinning={i % 2 === 0} />,
    (i, key) => <GtkProgressBar key={key} fraction={(i % 100) / 100} />,
    (i, key) => <GtkLevelBar key={key} value={(i % 10) / 10} />,
    (_i, key) => <GtkScale key={key} />,
    (_i, key) => <GtkSeparator key={key} />,
    (_i, key) => <GtkFrame key={key} label={`f-${key}`} />,
    (_i, key) => (
        <GtkBox key={key}>
            <GtkLabel>{`nested-${key}`}</GtkLabel>
        </GtkBox>
    ),
];

const ROW = (i: number): ReactNode => {
    const renderer = ROW_RENDERERS[i % ROW_RENDERERS.length];

    if (renderer === undefined) {
        throw new Error(`No row renderer for index ${String(i)}`);
    }

    return renderer(i, String(i));
};

const drawMixed = (n: number, salt: string): ReactNode =>
    scrolledBox(Array.from({ length: n }, (_, i) => ROW(i + salt.length)));

describe("mixed-widget mount", () => {
    for (const n of SIZES) {
        bench(`mount ${String(n)} mixed-class widgets`, async () => {
            await render(drawMixed(n, "a"));
            await cleanup();
        });
    }
});

describe("mixed-widget prop update", () => {
    for (const n of SIZES) {
        bench(`update one prop across ${String(n)} mixed-class widgets`, async () => {
            await render(drawMixed(n, "a"));

            for (let k = 0; k < 3; k++) {
                await render(drawMixed(n, "ab"));
                await render(drawMixed(n, "a"));
            }

            await cleanup();
        });
    }
});
