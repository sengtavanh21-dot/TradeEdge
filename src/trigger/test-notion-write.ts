import "dotenv/config";
import {writeToNotion} from "./stock-check";

writeToNotion("TEST", 100, 2.5, "HOLD", "test entry")
    .then(() => console.log("Wrote test entry to Notion"))
    .catch((error) => {
        console.error("Failed to write test entry to Notion:", error);
        process.exit(1);
    });
