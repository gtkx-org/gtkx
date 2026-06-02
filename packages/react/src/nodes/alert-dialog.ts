import type * as Adw from "@gtkx/gi/adw";
import { isShallowArrayEqual } from "@gtkx/utils";
import type { AlertDialogResponseProps } from "../jsx.js";
import { DialogNode } from "./dialog.js";
import { arraySync, type PropDescriptorTable, teardownNode } from "./internal/apply-props.js";

export class AlertDialogNode extends DialogNode {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            responses: arraySync<AlertDialogResponseProps, string>({
                equal: isShallowArrayEqual,
                clearItem: (id) => (this.backingInstance as Adw.AlertDialog).removeResponse(id),
                add: (response) => {
                    const dialog = this.backingInstance as Adw.AlertDialog;
                    dialog.addResponse(response.id, response.label);
                    if (response.appearance !== undefined) {
                        dialog.setResponseAppearance(response.id, response.appearance);
                    }
                    if (response.enabled !== undefined) {
                        dialog.setResponseEnabled(response.id, response.enabled);
                    }
                    return response.id;
                },
            }),
        };
    }

    public override detachDeletedInstance(): void {
        teardownNode(this, this.getPropTable());
        super.detachDeletedInstance();
    }
}
