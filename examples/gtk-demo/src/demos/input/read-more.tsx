import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./read-more.tsx?raw";

const TEXT = `I'd just like to interject for a moment. What you're referring to as Linux, is in fact, GNU/Linux, or as I've recently taken to calling it, GNU plus Linux. Linux is not an operating system unto itself, but rather another free component of a fully functioning GNU system made useful by the GNU corelibs, shell utilities and vital system components comprising a full OS as defined by POSIX.

Many computer users run a modified version of the GNU system every day, without realizing it. Through a peculiar turn of events, the version of GNU which is widely used today is often called "Linux", and many of its users are not aware that it is basically the GNU system, developed by the GNU Project.

There really is a Linux, and these people are using it, but it is just a part of the system they use. Linux is the kernel: the program in the system that allocates the machine's resources to the other programs that you run. The kernel is an essential part of an operating system, but useless by itself; it can only function in the context of a complete operating system. Linux is normally used in combination with the GNU operating system: the whole system is basically GNU with Linux added, or GNU/Linux. All the so-called "Linux" distributions are really distributions of GNU/Linux.`;

const ReadMoreDemo = () => {
    const [showMore, setShowMore] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
            {showMore ? (
                <GtkLabel label={TEXT} wrap xalign={0} yalign={0} widthChars={3} maxWidthChars={30} />
            ) : (
                <>
                    <GtkLabel
                        label={TEXT}
                        wrap
                        xalign={0}
                        yalign={0}
                        lines={3}
                        ellipsize={Pango.EllipsizeMode.END}
                        widthChars={3}
                        maxWidthChars={30}
                        vexpand
                    />
                    <GtkButton label="Read More" onClicked={() => setShowMore(true)} />
                </>
            )}
        </GtkBox>
    );
};

export const readMoreDemo: Demo = {
    id: "read-more",
    title: "Read More",
    description:
        "A simple implementation of a widget that can either display a lot of text or just the first few lines with a 'Read More' button.",
    keywords: ["text", "expand", "read more", "truncate", "ellipsis", "lines", "GtkInscription"],
    component: ReadMoreDemo,
    sourceCode,
};
