export async function sendPriceDropEmail(partId, oldPrice, newPrice) {
  console.log(
    `[ALERT SERVICE] Price dropped for ${partId}: $${oldPrice} -> $${newPrice}`
  );

  return {
    success: true,
    message: "Notification triggered"
  };
}