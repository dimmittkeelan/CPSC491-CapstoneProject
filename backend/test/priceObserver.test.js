import test from "node:test";
import assert from "node:assert";

import {
  checkPriceDrop,
  trackPart,
  observeNewPrice
} from "../services/priceObserver.js";

test("detect price drop", () => {
  const result = checkPriceDrop(400, 350);

  assert.strictEqual(result.priceDropped, true);
  assert.strictEqual(result.difference, 50);
});

test("detect no price drop", () => {
  const result = checkPriceDrop(300, 350);

  assert.strictEqual(result.priceDropped, false);
});

test("track part then observe drop", () => {
  trackPart("gpu1", 500);

  const result = observeNewPrice("gpu1", 450);

  assert.strictEqual(result.priceDropped, true);
});