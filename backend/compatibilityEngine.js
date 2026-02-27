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