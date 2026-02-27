export function checkCpuMotherboardCompatibility(cpu, motherboard) {
  if (!cpu || !motherboard) {
    return {
      compatible: false,
      issues: ["Missing CPU or motherboard data"]
    };
  }

  if (cpu.socket !== motherboard.socket) {
    return {
      compatible: false,
      issues: [
        `CPU socket ${cpu.socket} does not match motherboard socket ${motherboard.socket}`
      ]
    };
  }

  return {
    compatible: true,
    issues: []
  };
}