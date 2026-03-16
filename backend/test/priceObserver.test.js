import {
  checkPriceDrop,
  trackPart,
  observeNewPrice
} from "../services/priceObserver.js";

test("detect price drop", () => {
  const result = checkPriceDrop(400, 350);

  expect(result.priceDropped).toBe(true);
  expect(result.difference).toBe(50);
});

test("detect no price drop", () => {
  const result = checkPriceDrop(300, 350);

  expect(result.priceDropped).toBe(false);
});

test("track part then observe drop", () => {
  trackPart("gpu1", 500);

  const result = observeNewPrice("gpu1", 450);

  expect(result.priceDropped).toBe(true);
});