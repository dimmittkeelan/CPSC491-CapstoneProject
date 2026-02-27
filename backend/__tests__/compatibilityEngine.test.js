import {
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
} from "../compatibilityEngine.js";

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

test("RAM type matches motherboard -> compatible", () => {
  const ram = { type: "DDR5" };
  const motherboard = { ramType: "DDR5" };

  const result = checkRamMotherboardCompatibility(ram, motherboard);

  expect(result.compatible).toBe(true);
  expect(result.issues).toEqual([]);
});

test("RAM type mismatch -> incompatible", () => {
  const ram = { type: "DDR4" };
  const motherboard = { ramType: "DDR5" };

  const result = checkRamMotherboardCompatibility(ram, motherboard);

  expect(result.compatible).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
});