type RefreshTracker = {
    performRefresh: () => void;
    isRefreshing: () => boolean;
};

const createRefreshTracker = (performRefresh: () => void): RefreshTracker => {
    let isRefreshing = false;

    return {
        performRefresh: () => {
            isRefreshing = true;

            try {
                performRefresh();
            } finally {
                setTimeout(() => {
                    isRefreshing = false;
                }, 0);
            }
        },
        isRefreshing: () => isRefreshing,
    };
};

export { createRefreshTracker, type RefreshTracker };
