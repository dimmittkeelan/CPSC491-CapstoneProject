export function checkCpuMotherboardCompatibility(cpu, motherboard) {
  if (!cpu || !motherboard) {
    return {
      compatible: false,
      issues: ["Missing CPU or motherboard data"],
    };
  }

  if (cpu.socket !== motherboard.socket) {
    return {
      compatible: false,
      issues: [
        `CPU socket ${cpu.socket} does not match motherboard socket ${motherboard.socket}`,
      ],
    };
  }

  return {
    compatible: true,
    issues: [],
  };
}

export function checkRamMotherboardCompatibility(ram, motherboard) {
  if (!ram || !motherboard) {
    return {
      compatible: false,
      issues: ["Missing RAM or motherboard data"],
    };
  }

  if (ram.type !== motherboard.ramType) {
    return {
      compatible: false,
      issues: [
        `RAM type ${ram.type} does not match motherboard RAM type ${motherboard.ramType}`,
      ],
    };
  }

  return {
    compatible: true,
    issues: [],
  };
}

export function checkPsuWattageCompatibility(psu, cpu, gpu, baseBuffer = 100) {
  if (!psu) {
    return {
      compatible: false,
      issues: ["Missing PSU data"]
    };
  }

  if (typeof psu.wattage !== "number") {
    return {
      compatible: false,
      issues: ["Missing or invalid PSU wattage"]
    };
  }

  const cpuTdp = typeof cpu?.tdp === "number" ? cpu.tdp : 0;
  const gpuTdp = typeof gpu?.tdp === "number" ? gpu.tdp : 0;

  const required = cpuTdp + gpuTdp + baseBuffer;

  if (psu.wattage < required) {
    return {
      compatible: false,
      issues: [
        `PSU wattage ${psu.wattage}W is below estimated required ${required}W`
      ]
    };
  }

  return {
    compatible: true,
    issues: []
  };
}