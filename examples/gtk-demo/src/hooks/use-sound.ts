import * as Gtk from "@gtkx/ffi/gtk";
import { useCallback, useEffect, useRef } from "react";

interface SoundOptions {
    volume?: number;
    loop?: boolean;
}

interface SoundPlayer {
    play: () => void;
    stop: () => void;
    setVolume: (volume: number) => void;
}

export const useSound = (path: string, options: SoundOptions = {}): SoundPlayer => {
    const mediaFileRef = useRef<Gtk.MediaFile | null>(null);
    const { volume = 1.0, loop = false } = options;

    useEffect(() => {
        try {
            const mediaFile = Gtk.MediaFile.newForFilename(path);
            mediaFile.setVolume(volume);
            mediaFile.setLoop(loop);
            mediaFileRef.current = mediaFile;
        } catch {
            mediaFileRef.current = null;
        }

        return () => {
            if (mediaFileRef.current) {
                mediaFileRef.current.pause();
                mediaFileRef.current = null;
            }
        };
    }, [path, volume, loop]);

    const play = useCallback(() => {
        const mediaFile = mediaFileRef.current;
        if (mediaFile) {
            mediaFile.seek(0);
            mediaFile.play();
        }
    }, []);

    const stop = useCallback(() => {
        const mediaFile = mediaFileRef.current;
        if (mediaFile) {
            mediaFile.pause();
            mediaFile.seek(0);
        }
    }, []);

    const setVolume = useCallback((newVolume: number) => {
        const mediaFile = mediaFileRef.current;
        if (mediaFile) {
            mediaFile.setVolume(Math.max(0, Math.min(1, newVolume)));
        }
    }, []);

    return { play, stop, setVolume };
};

export const SYSTEM_SOUNDS = {
    click: "/usr/share/sounds/freedesktop/stereo/button-pressed.oga",
    complete: "/usr/share/sounds/freedesktop/stereo/complete.oga",
    error: "/usr/share/sounds/freedesktop/stereo/dialog-error.oga",
    warning: "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga",
    info: "/usr/share/sounds/freedesktop/stereo/dialog-information.oga",
    bell: "/usr/share/sounds/freedesktop/stereo/bell.oga",
    message: "/usr/share/sounds/freedesktop/stereo/message.oga",
    trashEmpty: "/usr/share/sounds/freedesktop/stereo/trash-empty.oga",
};
