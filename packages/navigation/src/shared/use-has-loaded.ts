import { useState } from "react";

const useHasLoaded = (isLoaded: boolean): boolean => {
    const [hasLoaded, setHasLoaded] = useState(isLoaded);

    if (isLoaded && !hasLoaded) {
        setHasLoaded(true);
    }

    return isLoaded || hasLoaded;
};

export { useHasLoaded };
