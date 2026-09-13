type Wrapped = Promise<{
    value: string;
}>;

type Deep = {
    first: {
        second: {
            third: {
                fourth: {
                    fifth: {
                        sixth: {
                            seventh: {
                                eighth: {
                                    ninth: {
                                        value: string;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
};

type Callable = {
    (): void;
    new (): Wrapped;
};

type Recursive<T> = () => Recursive<T[]>;

declare const recursive: Recursive<number>;

export { type Callable, type Deep, type Recursive, type Wrapped, recursive };
