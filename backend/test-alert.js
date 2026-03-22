import { trackPart, observeNewPrice } from "./services/priceObserver.js";

async function run() {
  console.log("Tracking part...");
  trackPart("gpu1", 500);

  console.log("Triggering price drop...");
  const result = await observeNewPrice("gpu1", 400);

  console.log("Result:", result);
}

run().catch(console.error);