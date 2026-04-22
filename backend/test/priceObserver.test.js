import {
  checkPriceDrop,
  trackPart,
  observeNewPrice,
  trackedParts,
} from "../services/priceObserver.js";

beforeEach(() => {
  trackedParts.clear();
});

test("detect price drop", () => {
  const result = checkPriceDrop(400, 350);

  expect(result.priceDropped).toBe(true);
  expect(result.difference).toBe(50);
});

test("detect no price drop", () => {
  const result = checkPriceDrop(300, 350);

  expect(result.priceDropped).toBe(false);
  expect(result.difference).toBe(0);
});

test("track part then observe drop", async () => {
  trackPart("gpu1", 500);

  const result = await observeNewPrice("gpu1", 450);

  expect(result.priceDropped).toBe(true);
});
