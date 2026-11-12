/**
 * El dinero vive en BD como BIGINT (céntimos) y Prisma lo devuelve como bigint. En JSON se expone
 * como number: los importes de una asociación están muy lejos de Number.MAX_SAFE_INTEGER.
 */
export function toNumber(value: bigint | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function toNullableNumber(value: bigint | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

export function toBigInt(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Not a safe integer amount: ${value}`);
  return BigInt(value);
}

/** 7.5 % → 750 bp (las DTO ya validan como mucho dos decimales). */
export function percentToBp(percent: number): number {
  return Math.round(percent * 100);
}

export function bpToPercent(bp: number): number {
  return bp / 100;
}
