// ============================================================
// JEET ERP — Weighted Average Cost (WAC) Service (PURE MATH)
// ============================================================

export const weightedAverageService = {
  /**
   * Rounds a cost to 4 decimal places.
   */
  round4(val: number): number {
    return Math.round(val * 10000) / 10000;
  },

  /**
   * Recalculates the weighted average cost when new items are added to stock.
   * Formula: ((currentQty * currentAvgCost) + (addedQty * unitCost)) / (currentQty + addedQty)
   */
  calculateNewAverage(
    currentQty: number,
    currentAvgCost: number,
    addedQty: number,
    unitCost: number
  ): number {
    // Input validation
    const curQty = Number(currentQty) || 0;
    const curAvg = Number(currentAvgCost) || 0;
    const addQty = Number(addedQty) || 0;
    const itemCost = Number(unitCost) || 0;

    // Cost guard: If no items added or item cost is negative/zero, return current cost
    if (addQty <= 0 || itemCost <= 0) {
      return this.round4(curAvg);
    }

    // Cost guard: If current quantity on hand is negative or zero, new WAC is simply the receipt unit cost
    if (curQty <= 0) {
      return this.round4(itemCost);
    }

    const totalQty = curQty + addQty;
    if (totalQty === 0) {
      return this.round4(itemCost);
    }

    const currentValue = curQty * curAvg;
    const addedValue = addQty * itemCost;
    const newAvg = (currentValue + addedValue) / totalQty;

    return this.round4(newAvg);
  }
};

export default weightedAverageService;
