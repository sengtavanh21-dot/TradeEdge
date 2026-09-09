import {task,wait} from"@trigger.dev/sdk";

export const delayedGoodbye = task({
    id: "delayed-goodbye",
    run: async (payload:{name: string}) => {
        await wait.for ({seconds: 15});
        console.log(`Goodbye, ${payload.name}! See you in 15 seconds.`);
    },   
});
