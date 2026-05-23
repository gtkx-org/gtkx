import { css } from "@gtkx/css";
import type * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import * as WebKit from "@gtkx/ffi/webkit";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkEntry,
    GtkProgressBar,
    quit,
    WebKitWebView,
} from "@gtkx/react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_URL = "https://gtkx.dev";

const urlBarStyle = css`
    min-width: 400px;
`;

const progressStyle = css`
    &.hidden {
        opacity: 0;
    }
`;

const normalizeUrl = (targetUrl: string): string => {
    const trimmed = targetUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
};

interface BrowserState {
    url: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    progress: number;
}

const useBrowserController = (webViewRef: RefObject<WebKit.WebView | null>) => {
    const [state, setState] = useState<BrowserState>({
        url: DEFAULT_URL,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        progress: 0,
    });

    const setUrl = useCallback((url: string) => setState((s) => ({ ...s, url })), []);

    const navigate = useCallback(
        (targetUrl: string) => {
            webViewRef.current?.loadUri(normalizeUrl(targetUrl));
        },
        [webViewRef],
    );

    const handleLoadChanged = useCallback((loadEvent: WebKit.LoadEvent, webView: WebKit.WebView) => {
        setState((s) => ({
            ...s,
            canGoBack: webView.canGoBack(),
            canGoForward: webView.canGoForward(),
            ...(loadEvent === WebKit.LoadEvent.STARTED && { isLoading: true, progress: 0 }),
            ...(loadEvent === WebKit.LoadEvent.COMMITTED && { url: webView.getUri() ?? s.url }),
            ...(loadEvent === WebKit.LoadEvent.FINISHED && { isLoading: false, progress: 1 }),
        }));
    }, []);

    const handleNotify = useCallback(
        (pspec: GObject.ParamSpec) => {
            const webView = webViewRef.current;
            if (!webView || pspec.getName() !== "estimated-load-progress") return;
            setState((s) => ({ ...s, progress: webView.getEstimatedLoadProgress() }));
        },
        [webViewRef],
    );

    return { state, setUrl, navigate, handleLoadChanged, handleNotify };
};

const NavigationButtons = ({
    canGoBack,
    canGoForward,
    isLoading,
    onBack,
    onForward,
    onReloadOrStop,
}: {
    canGoBack: boolean;
    canGoForward: boolean;
    isLoading: boolean;
    onBack: () => void;
    onForward: () => void;
    onReloadOrStop: () => void;
}) => (
    <>
        <AdwHeaderBar.PackStart>
            <GtkButton iconName="go-previous-symbolic" onClicked={onBack} sensitive={canGoBack} tooltipText="Go back" />
        </AdwHeaderBar.PackStart>
        <AdwHeaderBar.PackStart>
            <GtkButton
                iconName="go-next-symbolic"
                onClicked={onForward}
                sensitive={canGoForward}
                tooltipText="Go forward"
            />
        </AdwHeaderBar.PackStart>
        <AdwHeaderBar.PackStart>
            <GtkButton
                iconName={isLoading ? "process-stop-symbolic" : "view-refresh-symbolic"}
                onClicked={onReloadOrStop}
                tooltipText={isLoading ? "Stop loading" : "Reload"}
            />
        </AdwHeaderBar.PackStart>
    </>
);

export const App = () => {
    const webViewRef = useRef<WebKit.WebView | null>(null);
    const { state, setUrl, navigate, handleLoadChanged, handleNotify } = useBrowserController(webViewRef);
    const { url, isLoading, canGoBack, canGoForward, progress } = state;

    useEffect(() => {
        navigate(DEFAULT_URL);
    }, [navigate]);

    return (
        <AdwApplicationWindow title="GTKX Browser" defaultWidth={1024} defaultHeight={768} onClose={quit}>
            <AdwToolbarView>
                <AdwToolbarView.AddTopBar>
                    <AdwHeaderBar
                        titleWidget={
                            <GtkEntry
                                text={url}
                                onChanged={(entry: Gtk.Entry) => setUrl(entry.getText())}
                                onActivate={() => navigate(url)}
                                hexpand
                                cssClasses={[urlBarStyle]}
                                placeholderText="Enter URL..."
                            />
                        }
                    >
                        <NavigationButtons
                            canGoBack={canGoBack}
                            canGoForward={canGoForward}
                            isLoading={isLoading}
                            onBack={() => webViewRef.current?.goBack()}
                            onForward={() => webViewRef.current?.goForward()}
                            onReloadOrStop={() =>
                                isLoading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()
                            }
                        />
                    </AdwHeaderBar>
                </AdwToolbarView.AddTopBar>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                    <GtkProgressBar fraction={progress} cssClasses={[progressStyle, isLoading ? "" : "hidden"]} />
                    <WebKitWebView
                        ref={webViewRef}
                        vexpand
                        hexpand
                        onLoadChanged={handleLoadChanged}
                        onNotify={handleNotify}
                    />
                </GtkBox>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};
