// Placeholder test file for Sprint 1.
// Real automated tests will be added in later sprints.

function isValidBudget(value) {
  if (value === null || value === undefined) return false;
  const num = Number(value);
  if (Number.isNaN(num)) return false;
  return num >= 300; // example minimum budget rule
}

// Simple sanity checks (can be expanded later)
console.log("Budget 1000 valid?", isValidBudget(1000)); // expected: true
console.log("Budget 'abc' valid?", isValidBudget("abc")); // expected: false
console.log("Budget 200 valid?", isValidBudget(200)); // expected: false
