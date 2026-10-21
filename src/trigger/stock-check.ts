import {schedules, runs, idempotencyKeys} from "@trigger.dev/sdk";
import { stockProcess } from "./stock-process.js";

export const stockCheck = schedules.task({
    id: "stock-check",
    retry:{ maxAttempts: 1 },
    cron: "0 */6 * * 1-5", // every 6 hours, Mon–Fri (UTC)
    run: async (payload)=> {
        const ticker = process.env.WATCHED_TICKER;
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

        if (!ticker) throw new Error("WATCHED_TICKER is not set");
        if (!apiKey) throw new Error("ALPHA_VANTAGE_API_KEY is not set");

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) {
                throw new Error(`Failed to fetch stock data: ${response.statusText}`);
            }
            const data = await response.json();

            if (data["Information"] || data["Note"]) {
                throw new Error("Alpha Vantage rate limit reached");
            }

            if (!data["Global Quote"]) {
              throw new Error(`Unexpected Alpha Vantage response (keys: ${Object.keys(data).join(", ")})`);
            }
            const price = parseFloat(data["Global Quote"]["05. price"]);
            if (Number.isNaN(price)) {
                throw new Error(`Unexpected Alpha Vantage response (keys: ${Object.keys(data["Global Quote"]).join(", ")})`);
            }
            const tradingDay: string | undefined = data["Global Quote"]["07. latest trading day"];
            if (!tradingDay) {
                throw new Error("Unexpected Alpha Vantage response (no trading day)");
            }

            console.log(`Checking stock for: ${ticker}`);
            console.log(`Current price for ${ticker}: ${price}`);

            // Find the last completed stock-process run so we have a price and trading day to compare against.
            const previousRuns = await runs.list({
                taskIdentifier: "stock-process",
                status: "COMPLETED",
                limit: 1,
            });
            const previousRunSummary = previousRuns.data[0];

            let previousOutput: { ticker?: string; price?: number; tradingDay?: string } | null = null;
            if (previousRunSummary) {
                const previousRun = await runs.retrieve(previousRunSummary.id);
                // Only compare against the previous run if it was checking the same ticker -
                // otherwise a changed WATCHED_TICKER would produce a nonsense percent change.
                if (previousRun.output?.ticker === ticker) {
                    previousOutput = previousRun.output;
                }
            }

            if (previousOutput?.tradingDay === tradingDay) {
                console.log(`No new trading day (${tradingDay}), skipping`);
                return { skipped: true, ticker, tradingDay };
            }

            const previousPrice: number | null = previousOutput?.price ?? null;
            const percentChange = previousPrice !== null
                ? ((price - previousPrice) / previousPrice) * 100
                : null;

            const result = await stockProcess.triggerAndWait(
                { ticker, price, previousPrice, percentChange, tradingDay },
                { idempotencyKey: await idempotencyKeys.create(`${ticker}-${tradingDay}`, { scope: "global" }) },
            );

            if (!result.ok) {
                throw new Error("stock-process failed");
            }

            return result.output;
        } catch (error) {
            console.error(`Error checking stock for ${ticker}:`, error);
            throw error;
        }
    },
});
