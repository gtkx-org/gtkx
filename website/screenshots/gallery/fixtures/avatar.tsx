import { AdwAvatar } from "@gtkx/jsx/adw";
import { GtkBox } from "@gtkx/jsx/gtk";

export const Demo = () => (
    <GtkBox spacing={16}>
        <AdwAvatar text="Ada Lovelace" showInitials size={56} />
        <AdwAvatar text="Grace Hopper" showInitials size={56} />
        <AdwAvatar iconName="document-edit-symbolic" size={56} />
    </GtkBox>
);
