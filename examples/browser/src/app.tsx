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
    x,
} from "@gtkx/react";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_URL = "https://eugeniodepalo.github.io/gtkx/";

const urlBarStyle = css`
    min-width: 400px;
`;

const progressStyle = css`
    &.hidden {
        opacity: 0;
    }
`;

export const App = () => {
    const webViewRef = useRef<WebKit.WebView | null>(null);
    const [url, setUrl] = useState(DEFAULT_URL);
    const [isLoading, setIsLoading] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [progress, setProgress] = useState(0);

    const navigate = useCallback((targetUrl: string) => {
        const webView = webViewRef.current;
        if (!webView) return;

        let finalUrl = targetUrl.trim();
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = `https://${finalUrl}`;
        }
        webView.loadUri(finalUrl);
    }, []);

    const handleActivate = useCallback(() => {
        navigate(url);
    }, [url, navigate]);

    const handleBack = useCallback(() => {
        webViewRef.current?.goBack();
    }, []);

    const handleForward = useCallback(() => {
        webViewRef.current?.goForward();
    }, []);

    const handleReload = useCallback(() => {
        webViewRef.current?.reload();
    }, []);

    const handleStop = useCallback(() => {
        webViewRef.current?.stopLoading();
    }, []);

    const handleLoadChanged = useCallback((loadEvent: WebKit.LoadEvent, webView: WebKit.WebView) => {
        setCanGoBack(webView.canGoBack());
        setCanGoForward(webView.canGoForward());

        switch (loadEvent) {
            case WebKit.LoadEvent.STARTED:
                setIsLoading(true);
                setProgress(0);
                break;
            case WebKit.LoadEvent.COMMITTED: {
                const currentUri = webView.getUri();
                if (currentUri) {
                    setUrl(currentUri);
                }
                break;
            }
            case WebKit.LoadEvent.FINISHED:
                setIsLoading(false);
                setProgress(1);
                break;
        }
    }, []);

    const handleNotify = useCallback((pspec: GObject.ParamSpec, self: Gtk.Widget) => {
        if (pspec.getName() === "estimated-load-progress") {
            const webView = self as WebKit.WebView;
            setProgress(webView.getEstimatedLoadProgress());
        }
    }, []);

    useEffect(() => {
        navigate(DEFAULT_URL);
    }, [navigate]);

    return (
        <AdwApplicationWindow title="GTKX Browser" defaultWidth={1024} defaultHeight={768} onClose={quit}>
            <AdwToolbarView>
                <x.ToolbarTop>
                    <AdwHeaderBar>
                        <x.PackStart>
                            <GtkButton
                                iconName="go-previous-symbolic"
                                onClicked={handleBack}
                                sensitive={canGoBack}
                                tooltipText="Go back"
                            />
                        </x.PackStart>
                        <x.PackStart>
                            <GtkButton
                                iconName="go-next-symbolic"
                                onClicked={handleForward}
                                sensitive={canGoForward}
                                tooltipText="Go forward"
                            />
                        </x.PackStart>
                        <x.PackStart>
                            <GtkButton
                                iconName={isLoading ? "process-stop-symbolic" : "view-refresh-symbolic"}
                                onClicked={isLoading ? handleStop : handleReload}
                                tooltipText={isLoading ? "Stop loading" : "Reload"}
                            />
                        </x.PackStart>
                        <x.Slot for="AdwHeaderBar" id="titleWidget">
                            <GtkEntry
                                text={url}
                                onChanged={(entry: Gtk.Entry) => setUrl(entry.getText())}
                                onActivate={handleActivate}
                                hexpand
                                cssClasses={[urlBarStyle]}
                                placeholderText="Enter URL..."
                            />
                        </x.Slot>
                    </AdwHeaderBar>
                </x.ToolbarTop>
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

export default App;
