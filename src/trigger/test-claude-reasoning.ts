import {task} from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Manually-triggered task to verify the Claude reasoning step in isolation,
// using hardcoded prices instead of an Alpha Vantage call. Delete after use.
export const testClaudeReasoning = task({
    id: "test-claude-reasoning",
    retry: { maxAttempts: 1 },
    run: async () => {
        const ticker = "TEST";
        const price = 230.15;
        const previousPrice: number | null = 227.50;

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

        const result = {
            ticker,
            price,
            previousPrice,
            percentChange,
            ai: aiAnalysis,
        };

        console.log(`Analysis for ${ticker}:`, result);

        return result;
    },
});
