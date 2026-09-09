import {task, wait} from "@trigger.dev/sdk";

export const weatherCheck = task({
    id: "weather-check",
    run: async (payload: { city:string }) => {
        await wait.for({ seconds: 10}); // wait for 10 seconds 
        console.log (`weather check complete for ${payload.city}`);
    
    },
}) ;