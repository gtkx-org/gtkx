import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { drainAfterEachTest } from "./memory.js";

const prepareMemoryChecks = (): void => {
    GIMarshallingTests.Object.noneReturn();
    GIMarshallingTests.Object.noneOut();
    GIMarshallingTests.utf8NoneReturn();
    GIMarshallingTests.garrayUtf8NoneReturn();
    GIMarshallingTests.gptrarrayUtf8NoneReturn();
    GIMarshallingTests.ghashtableUtf8NoneReturn();
    Regress.testStrvOutC();
    drainAfterEachTest();
};

export { prepareMemoryChecks };
