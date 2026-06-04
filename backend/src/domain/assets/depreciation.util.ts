import { IDepreciationMethod } from '@domain/_interfaces/asset.interface';

export interface DepreciationInputs {
  purchaseCost: number | null;
  purchaseDate: string | null;
  salvageValue: number | null;
  usefulLifeMonths: number | null;
  depreciationMethod: IDepreciationMethod | null;
}

export interface DepreciationComputed {
  monthlyDepreciation: number | null;
  accumulatedDepreciation: number | null;
  bookValue: number | null;
}

function wholeMonthsBetween(startIso: string, end: Date): number {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 0;
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function computeDepreciation(inputs: DepreciationInputs, asOf: Date = new Date()): DepreciationComputed {
  const empty: DepreciationComputed = {
    monthlyDepreciation: null,
    accumulatedDepreciation: null,
    bookValue: null,
  };

  const { purchaseCost, purchaseDate, usefulLifeMonths, depreciationMethod } = inputs;
  if (
    purchaseCost == null ||
    purchaseDate == null ||
    usefulLifeMonths == null ||
    usefulLifeMonths <= 0 ||
    depreciationMethod !== IDepreciationMethod.STRAIGHT_LINE
  ) {
    return empty;
  }

  const salvage = inputs.salvageValue ?? 0;
  const depreciableBase = purchaseCost - salvage;
  if (depreciableBase <= 0) {
    return {
      monthlyDepreciation: 0,
      accumulatedDepreciation: 0,
      bookValue: Math.max(salvage, purchaseCost),
    };
  }

  const monthlyDepreciation = depreciableBase / usefulLifeMonths;
  const monthsElapsed = Math.min(wholeMonthsBetween(purchaseDate, asOf), usefulLifeMonths);
  const accumulatedDepreciation = Math.min(depreciableBase, monthlyDepreciation * monthsElapsed);
  const bookValue = Math.max(salvage, purchaseCost - accumulatedDepreciation);

  return {
    monthlyDepreciation: round2(monthlyDepreciation),
    accumulatedDepreciation: round2(accumulatedDepreciation),
    bookValue: round2(bookValue),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
