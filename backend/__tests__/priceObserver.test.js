import {
    trackPart,
    observeNewPrice,
    checkPriceDrop,
    getObserverStatus,
    trackedParts,
  } from "../services/priceObserver.js";
  
  describe("Price Observer Tests", () => {
    beforeEach(() => {
      trackedParts.clear();
    });
  
    test("TC-01: price drop triggers detection", async () => {
      trackPart("gpu1", 500);
      const result = await observeNewPrice("gpu1", 400);
  
      expect(result.priceDropped).toBe(true);
      expect(result.difference).toBe(100);
    });
  
    test("TC-02: same price does not trigger drop", async () => {
      trackPart("gpu2", 500);
      const result = await observeNewPrice("gpu2", 500);
  
      expect(result.priceDropped).toBe(false);
      expect(result.difference).toBe(0);
    });
  
    test("TC-03: price increase does not trigger drop", async () => {
      trackPart("gpu3", 500);
      const result = await observeNewPrice("gpu3", 600);
  
      expect(result.priceDropped).toBe(false);
      expect(result.difference).toBe(0);
    });
  
    test("TC-04: untracked part throws error", async () => {
      await expect(observeNewPrice("unknown", 300)).rejects.toThrow(
        "Part not tracked"
      );
    });
  
    test("TC-05: invalid price in trackPart throws error", () => {
      expect(() => trackPart("gpu4", -100)).toThrow("Invalid price");
    });
  
    test("TC-06: missing partId in trackPart throws error", () => {
      expect(() => trackPart("", 200)).toThrow("partId is required");
    });
  
    test("TC-07: invalid newPrice in observeNewPrice throws error", async () => {
      trackPart("gpu5", 500);
      await expect(observeNewPrice("gpu5", -1)).rejects.toThrow("Invalid price");
    });
  
    test("TC-08: observer status updates tracked count", () => {
      trackPart("gpu6", 200);
      trackPart("gpu7", 300);
  
      const status = getObserverStatus();
  
      expect(status.trackedCount).toBe(2);
      expect(status.observer).toBe("active");
      expect(typeof status.timestamp).toBe("string");
    });
  
    test("TC-09: checkPriceDrop validates numeric inputs", () => {
      expect(() => checkPriceDrop("500", 400)).toThrow("Prices must be numbers");
    });
  });