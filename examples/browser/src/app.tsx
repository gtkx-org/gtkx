import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/gi/gtk";
import * as WebKit from "@gtkx/gi/webkit";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkEntry, GtkProgressBar } from "@gtkx/jsx/gtk";
import { WebKitWebView } from "@gtkx/jsx/webkit";
import { quit } from "@gtkx/react";
import { type RefObject, useEffect, useRef, useState } from "react";

type BrowserState = {
    url: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    progress: number;
};

const START_URL = "https://gtkx.dev";

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

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }

    return `https://${trimmed}`;
};

const navigateTo = (webViewRef: RefObject<WebKit.WebView | null>, targetUrl: string) => {
    webViewRef.current?.loadUri(normalizeUrl(targetUrl));
};

const useBrowserController = (webViewRef: RefObject<WebKit.WebView | null>) => {
    const [state, setState] = useState<BrowserState>({
        url: START_URL,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        progress: 0,
    });

    useEffect(() => {
        navigateTo(webViewRef, START_URL);
    }, [webViewRef]);

    const setUrl = (url: string) => {
        setState((s) => ({ ...s, url }));
    };

    const navigate = (targetUrl: string) => {
        navigateTo(webViewRef, targetUrl);
    };

    const handleLoadChanged = (loadEvent: WebKit.LoadEvent, webView: WebKit.WebView) => {
        setState((s) => ({
            ...s,
            canGoBack: webView.canGoBack(),
            canGoForward: webView.canGoForward(),
            ...(loadEvent === WebKit.LoadEvent.STARTED && { isLoading: true, progress: 0 }),
            ...(loadEvent === WebKit.LoadEvent.COMMITTED && { url: webView.getUri() }),
            ...(loadEvent === WebKit.LoadEvent.FINISHED && { isLoading: false, progress: 1 }),
        }));
    };

    const handleEstimatedLoadProgress = (progress: number | null) => {
        setState((s) => ({ ...s, progress: progress ?? s.progress }));
    };

    return { state, setUrl, navigate, handleLoadChanged, handleEstimatedLoadProgress };
};

const UrlEntry = ({
    url,
    onUrlChanged,
    onActivate,
}: {
    url: string;
    onUrlChanged: (value: string) => void;
    onActivate: () => void;
}) => (
    <GtkEntry
        text={url}
        onChanged={(entry: Gtk.Entry) => {
            onUrlChanged(entry.getText());
        }}
        onActivate={onActivate}
        hexpand
        cssClasses={[urlBarStyle]}
        placeholderText="Enter URL..."
    />
);

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
        <GtkButton iconName="go-previous-symbolic" onClicked={onBack} sensitive={canGoBack} tooltipText="Go back" />
        <GtkButton
            iconName="go-next-symbolic"
            onClicked={onForward}
            sensitive={canGoForward}
            tooltipText="Go forward"
        />
        <GtkButton
            iconName={isLoading ? "process-stop-symbolic" : "view-refresh-symbolic"}
            onClicked={onReloadOrStop}
            tooltipText={isLoading ? "Stop loading" : "Reload"}
        />
    </>
);

const BrowserWindow = () => {
    const webViewRef = useRef<WebKit.WebView | null>(null);

    const { state, setUrl, navigate, handleLoadChanged, handleEstimatedLoadProgress } =
        useBrowserController(webViewRef);

    const { url, isLoading, canGoBack, canGoForward, progress } = state;

    return (
        <AdwApplicationWindow title="GTKX Browser" defaultWidth={1024} defaultHeight={768} onCloseRequest={quit}>
            <AdwToolbarView
                topBar={(
                    <AdwHeaderBar
                        titleWidget={(
                            <UrlEntry
                                url={url}
                                onUrlChanged={setUrl}
                                onActivate={() => {
                                    navigate(url);
                                }}
                            />
                        )}
                        start={(
                            <NavigationButtons
                                canGoBack={canGoBack}
                                canGoForward={canGoForward}
                                isLoading={isLoading}
                                onBack={() => webViewRef.current?.goBack()}
                                onForward={() => webViewRef.current?.goForward()}
                                onReloadOrStop={() =>
                                    isLoading ? webViewRef.current?.stopLoading() : webViewRef.current?.reload()}
                            />
                        )}
                    />
                )}
            >
                <GtkBox orientation={Gtk.Orientation.VERTICAL} vexpand>
                    <GtkProgressBar fraction={progress} cssClasses={[progressStyle, isLoading ? "" : "hidden"]} />
                    <WebKitWebView
                        ref={webViewRef}
                        vexpand
                        hexpand
                        onLoadChanged={handleLoadChanged}
                        onNotifyEstimatedLoadProgress={handleEstimatedLoadProgress}
                    />
                </GtkBox>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

const App = () => (
    <AdwApplication>
        <BrowserWindow />
    </AdwApplication>
);

export { App };
