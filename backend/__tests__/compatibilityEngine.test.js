import {
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
  checkPsuWattageCompatibility,
  checkRamCapacityCompatibility,
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

test("PSU wattage sufficient -> compatible", () => {
  const psu = { wattage: 650 };
  const cpu = { tdp: 105 };
  const gpu = { tdp: 200 };

  const result = checkPsuWattageCompatibility(psu, cpu, gpu);

  expect(result.compatible).toBe(true);
  expect(result.issues).toEqual([]);
});

test("PSU wattage insufficient -> incompatible", () => {
  const psu = { wattage: 450 };
  const cpu = { tdp: 105 };
  const gpu = { tdp: 250 };

  const result = checkPsuWattageCompatibility(psu, cpu, gpu);

  expect(result.compatible).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
});

test("RAM capacity within motherboard limit -> compatible", () => {
  const ram = { capacity: 32 };
  const motherboard = { maxRam: 64 };

  const result = checkRamCapacityCompatibility(ram, motherboard);

  expect(result.compatible).toBe(true);
  expect(result.issues).toEqual([]);
});

test("RAM capacity exceeds motherboard limit -> incompatible", () => {
  const ram = { capacity: 128 };
  const motherboard = { maxRam: 64 };

  const result = checkRamCapacityCompatibility(ram, motherboard);

  expect(result.compatible).toBe(false);
  expect(result.issues.length).toBeGreaterThan(0);
});