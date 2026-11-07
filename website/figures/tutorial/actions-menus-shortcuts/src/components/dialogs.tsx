import { About } from "./about.js";
import { Shortcuts } from "./shortcuts.js";

type Dialog = { kind: "none" } | { kind: "about" } | { kind: "shortcuts" };

type DialogsProps = {
    dialog: Dialog;
    onClose: () => void;
};

const Dialogs = ({ dialog, onClose }: DialogsProps) => {
    switch (dialog.kind) {
        case "about": {
            return <About onClose={onClose} />;
        }
        case "shortcuts": {
            return <Shortcuts onClose={onClose} />;
        }
        case "none": {
            return null;
        }
    }
};

export { type Dialog, Dialogs };
