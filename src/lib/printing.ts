export function calculatePrintCount(studentCount: number, reserveCount = 1) {
  if (!Number.isInteger(studentCount) || studentCount < 0) {
    throw new Error("studentCount must be a non-negative integer");
  }
  if (!Number.isInteger(reserveCount) || reserveCount < 0) {
    throw new Error("reserveCount must be a non-negative integer");
  }
  return studentCount + reserveCount;
}
