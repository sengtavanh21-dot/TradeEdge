import {schedules, runs} from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export const stockCheck = schedules.task({
    id: "stock-check",
    retry:{ maxAttempts: 1 },
    cron: "0 */6 * * *", // test: every 6 hours
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

            if (!data["Global Quote"]) {
              throw new Error(`No Global Quote in response: ${JSON.stringify(data)}`);
            }
            const price = parseFloat(data["Global Quote"]["05. price"]);
            if (Number.isNaN(price)) {
                throw new Error(`Could not parse price from response: ${JSON.stringify(data)}`);
            }

            console.log(`Checking stock for: ${ticker}`);
            console.log(`Current price for ${ticker}: ${price}`);

            // Find the previous completed run of this task so we have a price to compare against.
            const previousRuns = await runs.list({
                taskIdentifier: "stock-check",
                status: "COMPLETED",
                limit: 1,
            });
            const previousRunSummary = previousRuns.data[0];

            let previousPrice: number | null = null;
            if (previousRunSummary) {
                const previousRun = await runs.retrieve(previousRunSummary.id);
                // Only compare against the previous run if it was checking the same ticker -
                // otherwise a changed WATCHED_TICKER would produce a nonsense percent change.
                if (previousRun.output?.ticker === ticker) {
                    previousPrice = previousRun.output?.price ?? null;
                }
            }

            const percentChange = previousPrice !== null
                ? ((price - previousPrice) / previousPrice) * 100
                : null;

            const systemPrompt = `You are a stock trading signal assistant. Reply with JSON only - no prose, no markdown code fences - in exactly this shape: {"signal": "BUY" | "SELL" | "HOLD", "percent_change": number, "reasoning": string}.`;

            const userPrompt = previousPrice !== null
                ? `Ticker: ${ticker}\nCurrent price: ${price}\nPrevious price: ${previousPrice}\nPercent change: ${percentChange!.toFixed(4)}%`
                : `Ticker: ${ticker}\nCurrent price: ${price}\nThere is no previous run yet, so there is no prior price to compare against.`;

            const message = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt }],
            });

            const textBlock = message.content.find((block) => block.type === "text");
            if (!textBlock || textBlock.type !== "text") {
                throw new Error("No text response from Claude");
            }

            let aiAnalysis: { signal: string; percent_change: number; reasoning: string };
            try {
                aiAnalysis = JSON.parse(textBlock.text);
            } catch (parseError) {
                throw new Error(`Failed to parse Claude JSON response: ${textBlock.text}`);
            }

            const result = {
                ticker,
                price,
                previousPrice,
                percentChange,
                ai: aiAnalysis,
            };

            console.log(`Analysis for ${ticker}:`, result);

            return result;
        } catch (error) {
            console.error(`Error checking stock for ${ticker}:`, error);
            throw error;
        }
    },
});
