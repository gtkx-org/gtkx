import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { getWidgetNodeText, waitFor, within } from "@gtkx/testing";
import { expect } from "vitest";

const rowTexts = (container: Gtk.Widget | null): (string | null)[] =>
    container === null
        ? []
        : within(container)
                .queryAllByRole(Gtk.AccessibleRole.LABEL)
                .map((widget) => getWidgetNodeText(widget));

const expectRowTexts = (ref: RefObject<Gtk.Widget | null>, expected: (string | null)[]): Promise<void> =>
    waitFor(() => {
        expect(rowTexts(ref.current)).toEqual(expected);
    });

export { expectRowTexts, rowTexts };
