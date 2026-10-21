import {task} from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function writeToNotion(
    ticker: string,
    price: number,
    percentChange: number | null,
    signal: string,
    reasoning: string,
    tradingDay: string,
) {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey) throw new Error("NOTION_API_KEY is not set");
    if (!databaseId) throw new Error("NOTION_DATABASE_ID is not set");

    const url = "https://api.notion.com/v1/pages";
    const body = {
        parent: {database_id: databaseId},
        properties: {
            Ticker: {title: [{text: {content: ticker}}]},
            Price: {number: price},
            "Percent Change": {number: percentChange},
            Signal: {select: {name: signal}},
            Reasoning: {rich_text: [{text: {content: reasoning}}]},
            "Trading Day": {date: {start: tradingDay}},
        },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
            throw new Error(`Failed to write to Notion: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`Error writing to Notion for ${ticker}:`, error);
        throw error;
    }
}

export type StockProcessPayload = {
    ticker: string;
    price: number;
    previousPrice: number | null;
    percentChange: number | null;
    tradingDay: string;
};

export const stockProcess = task({
    id: "stock-process",
    retry: { maxAttempts: 1 },
    run: async (payload: StockProcessPayload) => {
        const {ticker, price, previousPrice, percentChange, tradingDay} = payload;

        const systemPrompt = `You are a stock trading signal assistant. Reply with JSON only - no prose, no markdown code fences - in exactly this shape: {"signal": "BUY" | "SELL" | "HOLD", "percent_change": number, "reasoning": string}.`;

        const userPrompt = previousPrice !== null && percentChange !== null
            ? `Ticker: ${ticker}\nCurrent price: ${price}\nPrevious price: ${previousPrice}\nPercent change: ${percentChange.toFixed(4)}%`
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

        const cleanedText = textBlock.text
            .trim()
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();

        let aiAnalysis: { signal: string; percent_change: number; reasoning: string };
        try {
            aiAnalysis = JSON.parse(cleanedText);
        } catch (parseError) {
            throw new Error(`Failed to parse Claude JSON response: ${textBlock.text}`);
        }

        // Notion gets the code-computed percentChange, never Claude's percent_change.
        await writeToNotion(ticker, price, percentChange, aiAnalysis.signal, aiAnalysis.reasoning, tradingDay);

        return {
            ticker,
            price,
            previousPrice,
            percentChange,
            tradingDay,
            ai: aiAnalysis,
        };
    },
});
