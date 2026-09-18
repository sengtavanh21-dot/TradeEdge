import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_ztnloegfozoxfgetcipl",
  runtime: "node-22",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  onFailure: async ({ task, ctx, error }) => {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
      throw new Error("SLACK_WEBHOOK_URL is not set");
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `:x: Task failed: *${task}*\nRun ID: ${ctx.run.id}\nError: ${errorMessage}`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        console.warn(`Slack notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (slackError) {
      console.warn("Failed to send Slack failure notification:", slackError);
    }
  },
});
