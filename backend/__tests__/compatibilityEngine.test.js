import { checkCpuMotherboardCompatibility } from "../compatibilityEngine.js";

test("CPU and motherboard sockets match -> compatible", () => {
  const cpu = { socket: "AM5" };
  const motherboard = { socket: "AM5" };

  const result = checkCpuMotherboardCompatibility(cpu, motherboard);

  expect(result.compatible).toBe(true);
  expect(result.issues).toEqual([]);
});

test("CPU and motherboard sockets mismatch -> incompatible", () => {
  const cpu = { socket: "AM5" };
  const motherboard = { socket: "AM4" };

  const result = checkCpuMotherboardCompatibility(cpu, motherboard);

  expect(result.compatible).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
});