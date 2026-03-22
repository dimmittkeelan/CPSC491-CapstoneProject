export const trackedParts = new Map();

export function trackPart(partId, currentPrice) {
  trackedParts.set(partId, {
    lastPrice: currentPrice,
    lastChecked: new Date().toISOString()
  });

  return { success: true, partId };
}

export function checkPriceDrop(oldPrice, newPrice) {
  if (newPrice < oldPrice) {
    return {
      priceDropped: true,
      difference: oldPrice - newPrice
    };
  }

  return {
    priceDropped: false,
    difference: 0
  };
}

export function observeNewPrice(partId, newPrice) {
  const part = trackedParts.get(partId);

  if (!part) {
    throw new Error("Part not tracked");
  }

  const result = checkPriceDrop(part.lastPrice, newPrice);

  trackedParts.set(partId, {
    lastPrice: newPrice,
    lastChecked: new Date().toISOString()
  });

  return result;
}

export function getObserverStatus() {
  return {
    observer: "active",
    trackedCount: trackedParts.size,
    timestamp: new Date().toISOString()
  };
}