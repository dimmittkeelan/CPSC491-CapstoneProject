import { sendPriceDropEmail } from "./notificationService.js";

export const trackedParts = new Map();

// Track a new part
export function trackPart(partId, currentPrice) {
  if (!partId) {
    throw new Error("partId is required");
  }

  if (typeof currentPrice !== "number" || currentPrice < 0) {
    throw new Error("Invalid price");
  }

  trackedParts.set(partId, {
    lastPrice: currentPrice,
    lastChecked: new Date().toISOString(),
  });

  return { success: true, partId };
}

// Check price difference
export function checkPriceDrop(oldPrice, newPrice) {
  if (typeof oldPrice !== "number" || typeof newPrice !== "number") {
    throw new Error("Prices must be numbers");
  }

  if (newPrice < oldPrice) {
    return {
      priceDropped: true,
      difference: oldPrice - newPrice,
    };
  }

  return {
    priceDropped: false,
    difference: 0,
  };
}

// Observe price changes
export async function observeNewPrice(partId, newPrice) {
  if (!partId) {
    throw new Error("partId is required");
  }

  if (typeof newPrice !== "number" || newPrice < 0) {
    throw new Error("Invalid price");
  }

  const part = trackedParts.get(partId);

  if (!part) {
    throw new Error("Part not tracked");
  }

  const result = checkPriceDrop(part.lastPrice, newPrice);

  if (result.priceDropped) {
    await sendPriceDropEmail(partId, part.lastPrice, newPrice);
  }

  trackedParts.set(partId, {
    lastPrice: newPrice,
    lastChecked: new Date().toISOString(),
  });

  return result;
}

// Status
export function getObserverStatus() {
  return {
    observer: "active",
    trackedCount: trackedParts.size,
    timestamp: new Date().toISOString(),
  };
}