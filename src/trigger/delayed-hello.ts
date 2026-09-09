import {task,wait} from "@trigger.dev/sdk";

export const delayedHello = task({
  id: "delayed-hello",
  run: async (payload:{name: string}) => {
    await wait.for({seconds: 30}); // Wait for 30 seconds
    console.log(`Hello, ${payload.name}! This ran after a delay of 30 seconds.`);
  }
});

