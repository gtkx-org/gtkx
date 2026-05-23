import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { AdwToggleGroupProps, ToggleProps } from "../jsx.js";
import type { Container, Props } from "../types.js";
import { arraySync, imperative, type PropDescriptorTable, signal, teardownNode } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { shallowArrayEqual } from "./internal/props.js";
import { WidgetNode } from "./widget.js";

type ToggleGroupProps = Pick<AdwToggleGroupProps, "onActiveChanged" | "toggles" | "activeName" | "active">;

export class ToggleGroupNode extends WidgetNode<Adw.ToggleGroup, ToggleGroupProps> {
    public static override createContainer(
        typeName: string,
        props: Props,
        _containerClass: typeof Gtk.Widget,
    ): Container | null {
        const { activeName: _, active: __, ...rest } = props;
        return createContainerWithProperties(typeName, rest);
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            toggles: arraySync<ToggleProps, Adw.Toggle>({
                equal: shallowArrayEqual,
                clearItem: (toggle) => this.container.remove(toggle),
                add: (toggleProps) => {
                    const toggle = new Adw.Toggle();
                    applyToggleProps(toggle, toggleProps);
                    this.container.add(toggle);
                    return toggle;
                },
            }),
            activeName: imperative(() => {
                this.container.setActiveName(this.props.activeName ?? null);
            }),
            active: imperative(() => {
                const { active } = this.props;
                if (active != null) this.container.setActive(active);
            }),
            onActiveChanged: signal("notify::active", {
                getArgs: () => [this.container.getActive(), this.container.getActiveName()],
            }),
        };
    }

    public override detachDeletedInstance(): void {
        teardownNode(this, this.getPropTable());
        super.detachDeletedInstance();
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
