import express from "express";
import {
  trackPart,
  checkPriceDrop,
  observeNewPrice,
  getObserverStatus
} from "../services/priceObserver.js";

export const priceTrackingRouter = express.Router();

priceTrackingRouter.post("/price-check", (req, res) => {
  const { oldPrice, newPrice } = req.body;
  res.json(checkPriceDrop(oldPrice, newPrice));
});

priceTrackingRouter.post("/track", (req, res) => {
  const { partId, currentPrice } = req.body;
  res.json(trackPart(partId, currentPrice));
});

priceTrackingRouter.post("/observe", (req, res) => {
  const { partId, newPrice } = req.body;

  try {
    const result = observeNewPrice(partId, newPrice);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

priceTrackingRouter.get("/observer/status", (req, res) => {
  res.json(getObserverStatus());
});