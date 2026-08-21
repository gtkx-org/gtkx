import type { Logger } from "@gtkx/utils";
import { type Display, DisplayManager } from "@gtkx/gi/gdk";
import {
    checkVersion,
    CssProvider,
    Settings,
    STYLE_PROVIDER_PRIORITY_APPLICATION,
    StyleContext,
} from "@gtkx/gi/gtk";

type ProviderOptions = { priority: number; followsPreferences: boolean };

const REDUCED_MOTION_MINOR = 22;

const DEFAULT_OPTIONS: ProviderOptions = {
    priority: STYLE_PROVIDER_PRIORITY_APPLICATION,
    followsPreferences: true,
};

const hasReducedMotion = (): boolean => checkVersion(4, REDUCED_MOTION_MINOR, 0) === null;

const applyPreferences = (provider: CssProvider, settings: Settings): void => {
    provider.prefersColorScheme = settings.gtkInterfaceColorScheme;
    provider.prefersContrast = settings.gtkInterfaceContrast;

    if (hasReducedMotion()) {
        provider.prefersReducedMotion = settings.gtkInterfaceReducedMotion;
    }
};

const followSystemPreferences = (provider: CssProvider, display: Display): void => {
    const settings = Settings.getForDisplay(display);

    const sync = (): void => {
        applyPreferences(provider, settings);
    };

    sync();
    settings.on("notify::gtk-interface-color-scheme", sync);
    settings.on("notify::gtk-interface-contrast", sync);

    if (hasReducedMotion()) {
        settings.on("notify::gtk-interface-reduced-motion", sync);
    }
};

const registerProviderForDefaultDisplay = (options?: Partial<ProviderOptions>): CssProvider => {
    const { priority, followsPreferences } = { ...DEFAULT_OPTIONS, ...options };
    const provider = new CssProvider();
    const manager = DisplayManager.get();

    const attach = (display: Display): void => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        StyleContext.addProviderForDisplay(display, provider, priority);

        if (followsPreferences) {
            followSystemPreferences(provider, display);
        }
    };

    const initialDisplay = manager.getDefaultDisplay();

    if (initialDisplay) {
        attach(initialDisplay);
    } else {
        manager.once("display-opened", (openedDisplay: Display): void => {
            attach(openedDisplay);
        });
    }

    return provider;
};

const attachParsingErrorLogger = (provider: CssProvider, log: Logger, subject: string): void => {
    if (process.env.NODE_ENV !== "production") {
        provider.on("parsing-error", (section, error) => {
            log.warn(`GTK4 rejected ${subject} at ${section.toString()}: ${error.message}`);
        });
    }
};

export { type ProviderOptions, registerProviderForDefaultDisplay, attachParsingErrorLogger };
