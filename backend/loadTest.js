import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3001";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 25 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    "GET / status is 200": (r) => r.status === 200,
  });

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "GET /health status is 200": (r) => r.status === 200,
    "GET /health response ok": (r) => {
      const body = r.json();
      return body && body.ok === true;
    },
  });

  const compatibilityPayload = JSON.stringify({
    cpu: { socket: "AM5", tdp: 105 },
    motherboard: { socket: "AM5", ramType: "DDR5", maxRam: 128 },
    ram: { type: "DDR5", capacity: 32 },
    gpu: { tdp: 220 },
    psu: { wattage: 750 },
  });

  const compatibilityRes = http.post(
    `${BASE_URL}/api/compatibility`,
    compatibilityPayload,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  check(compatibilityRes, {
    "POST /api/compatibility status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
