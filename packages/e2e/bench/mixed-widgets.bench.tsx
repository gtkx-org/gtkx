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
import type { ReactNode } from "react";
import { bench, describe } from "vitest";
import { cleanup, render } from "../tests/helpers/production-render.js";
import { ScrollWrapper } from "../tests/helpers/scroll-wrapper.js";

const SIZES = [98, 392];

const ROW = (i: number): ReactNode => {
    const key = String(i);
    switch (i % 14) {
        case 0:
            return <GtkButton key={key} label={`b-${i}`} onClicked={() => undefined} />;
        case 1:
            return <GtkLabel key={key} label={`l-${i}`} />;
        case 2:
            return <GtkToggleButton key={key} label={`t-${i}`} active={i % 2 === 0} />;
        case 3:
            return <GtkCheckButton key={key} label={`c-${i}`} active={i % 3 === 0} />;
        case 4:
            return <GtkSwitch key={key} active={i % 2 === 0} />;
        case 5:
            return <GtkEntry key={key} text={`e-${i}`} />;
        case 6:
            return <GtkImage key={key} iconName="dialog-information" />;
        case 7:
            return <GtkSpinner key={key} spinning={i % 2 === 0} />;
        case 8:
            return <GtkProgressBar key={key} fraction={(i % 100) / 100} />;
        case 9:
            return <GtkLevelBar key={key} value={(i % 10) / 10} />;
        case 10:
            return <GtkScale key={key} />;
        case 11:
            return <GtkSeparator key={key} />;
        case 12:
            return <GtkFrame key={key} label={`f-${i}`} />;
        default:
            return (
                <GtkBox key={key}>
                    <GtkLabel label={`nested-${i}`} />
                </GtkBox>
            );
    }
};

const drawMixed = (n: number, salt: string): ReactNode => (
    <ScrollWrapper>
        <GtkBox>{Array.from({ length: n }, (_, i) => ROW(i + salt.length))}</GtkBox>
    </ScrollWrapper>
);

describe("mixed-widget mount", () => {
    for (const n of SIZES) {
        bench(`mount ${n} mixed-class widgets`, async () => {
            await render(drawMixed(n, "a"));
            await cleanup();
        });
    }
});

describe("mixed-widget prop update", () => {
    for (const n of SIZES) {
        bench(`update one prop across ${n} mixed-class widgets`, async () => {
            await render(drawMixed(n, "a"));
            for (let k = 0; k < 3; k++) {
                await render(drawMixed(n, "ab"));
                await render(drawMixed(n, "a"));
            }
            await cleanup();
        });
    }
});
