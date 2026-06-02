import * as Adw from "@gtkx/gi/adw";
import type * as Gtk from "@gtkx/gi/gtk";
import { isShallowArrayEqual } from "@gtkx/utils";
import type { AdwToggleGroupProps, ToggleProps } from "../jsx.js";
import type { BackingInstance, Props } from "../types.js";
import { arraySync, imperative, type PropDescriptorTable, signal, teardownNode } from "./internal/apply-props.js";
import { createContainerWithProperties } from "./internal/construct.js";
import { WidgetNode } from "./widget.js";

type ToggleGroupProps = Pick<AdwToggleGroupProps, "onActiveChanged" | "toggles" | "activeName" | "active">;

export class ToggleGroupNode extends WidgetNode<Adw.ToggleGroup, ToggleGroupProps> {
    public static override createContainer(
        typeName: string,
        props: Props,
        _containerClass: typeof Gtk.Widget,
    ): BackingInstance | null {
        const { activeName: _, active: __, ...rest } = props;
        return createContainerWithProperties(typeName, rest);
    }

    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            toggles: arraySync<ToggleProps, Adw.Toggle>({
                equal: isShallowArrayEqual,
                clearItem: (toggle) => this.backingInstance.remove(toggle),
                add: (toggleProps) => {
                    const toggle = new Adw.Toggle();
                    applyToggleProps(toggle, toggleProps);
                    this.backingInstance.add(toggle);
                    return toggle;
                },
            }),
            activeName: imperative(() => {
                this.backingInstance.setActiveName(this.props.activeName ?? null);
            }),
            active: imperative(() => {
                const { active } = this.props;
                if (active != null) this.backingInstance.setActive(active);
            }),
            onActiveChanged: signal("notify::active", {
                getArgs: () => [this.backingInstance.getActive(), this.backingInstance.getActiveName()],
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
