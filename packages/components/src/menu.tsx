import * as Gio from "@gtkx/gi/gio";
import { GMenu } from "@gtkx/jsx/gio";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { MenuItem, MenuProps } from "./types.js";

const appendItem = (menu: Gio.Menu, item: MenuItem): void => {
    if (item.submenu !== undefined) menu.appendSubmenu(item.label ?? null, toModel(item.submenu));
    else if (item.section !== undefined) menu.appendSection(item.label ?? null, toModel(item.section));
    else menu.append(item.label ?? null, item.action ?? null);
};

const toModel = (items: MenuItem[]): Gio.Menu => {
    const model = new Gio.Menu({});
    for (const item of items) appendItem(model, item);
    return model;
};

/** Builds a Gio.Menu model from a declarative array of menu items. */
export function Menu(props: MenuProps): ReactNode {
    const { items, ref, ...rest } = props;
    const [menu, refCallback] = useWidgetRef<Gio.Menu>(ref);
    const filled = useRef<{ menu: Gio.Menu; signature: string } | null>(null);
    useLayoutEffect(() => {
        if (menu === null) return;
        const entries = items ?? [];
        const signature = JSON.stringify(entries);
        if (filled.current?.menu === menu && filled.current.signature === signature) return;
        filled.current = { menu, signature };
        menu.removeAll();
        for (const item of entries) appendItem(menu, item);
    }, [menu, items]);
    return <GMenu ref={refCallback} {...rest} />;
}
