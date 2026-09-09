import {schedules} from "@trigger.dev/sdk";

export const stockCheck = schedules.task({
    id: "stock-check",
    cron: "0 */2 * * *", // test: every 2 hours
    run: async (payload)=> {
        const ticker = process.env.WATCHED_TICKER;
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

        if (!ticker) throw new Error("WATCHED_TICKER is not set");
        if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not set");

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch stock data: ${response.statusText}`);
            }
            const data = await response.json();

            if (!data["Global Quote"]) {
              throw new Error(`No Global Quote in response: ${JSON.stringify(data)}`);
            }
            const price = data["Global Quote"]["05. price"];

            console.log(`Checking stock for: ${ticker}`);
            console.log(`Current price for ${ticker}: ${price}`);
        } catch (error) {
            console.error(`Error checking stock for ${ticker}:`, error);
            throw error;
        }
    },
});
