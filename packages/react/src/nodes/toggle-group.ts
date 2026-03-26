import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { AdwToggleGroupProps, ToggleProps } from "../jsx.js";
import type { Container, Props } from "../types.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { filterProps, hasChanged } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

const DEFERRED_PROPS = ["activeName", "active"] as const;
const OWN_PROPS = ["onActiveChanged", "toggles", ...DEFERRED_PROPS] as const;

type OwnProps = Pick<AdwToggleGroupProps, (typeof OWN_PROPS)[number]>;

export class ToggleGroupNode extends WidgetNode<Adw.ToggleGroup, OwnProps> {
    private managedToggles: Adw.Toggle[] = [];

    public static override createContainer(props: Props, containerClass: typeof Gtk.Widget): Container | null {
        const { activeName: _, active: __, ...rest } = props;
        return createContainerWithProperties(containerClass, rest);
    }

    public override commitUpdate(oldProps: OwnProps | null, newProps: OwnProps): void {
        if (hasChanged(oldProps, newProps, "toggles")) {
            this.syncToggles(newProps.toggles ?? []);
        }

        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));

        if (hasChanged(oldProps, newProps, "activeName")) {
            this.container.setActiveName(newProps.activeName ?? null);
        }

        if (hasChanged(oldProps, newProps, "active")) {
            if (newProps.active != null) {
                this.container.setActive(newProps.active);
            }
        }

        if (hasChanged(oldProps, newProps, "onActiveChanged")) {
            const callback = newProps.onActiveChanged;
            this.signalStore.set(
                this,
                this.container,
                "notify::active",
                callback ? () => callback(this.container.getActive(), this.container.getActiveName()) : undefined,
            );
        }
    }

    public override detachDeletedInstance(): void {
        this.clearToggles();
        super.detachDeletedInstance();
    }

    private syncToggles(newToggles: ToggleProps[]): void {
        this.clearToggles();

        for (const toggleProps of newToggles) {
            const toggle = new Adw.Toggle();
            applyToggleProps(toggle, toggleProps);
            this.container.add(toggle);
            this.managedToggles.push(toggle);
        }
    }

    private clearToggles(): void {
        for (const toggle of this.managedToggles) {
            this.container.remove(toggle);
        }
        this.managedToggles = [];
    }
}

function applyToggleProps(toggle: Adw.Toggle, props: ToggleProps): void {
    if (props.id != null) toggle.setName(props.id);
    if (props.label != null) toggle.setLabel(props.label);
    if (props.iconName != null) toggle.setIconName(props.iconName);
    if (props.tooltip !== undefined) toggle.setTooltip(props.tooltip);
    if (props.enabled !== undefined) toggle.setEnabled(props.enabled);
    if (props.useUnderline !== undefined) toggle.setUseUnderline(props.useUnderline);
}
