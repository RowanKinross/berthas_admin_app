// Utility for checking if ingredient allocation is sufficient
export function isIngredientAllocationSufficient(batchCodeString, requiredQuantity) {
  if (!batchCodeString) return false;
  const totalAllocated = batchCodeString.split(',').reduce((sum, item) => {
    const [code, qty] = item.trim().split(':');
    return sum + (qty ? parseFloat(qty) : 0);
  }, 0);
  const roundedAllocated = Math.round(totalAllocated * 100) / 100;
  const roundedRequired = Math.round(requiredQuantity * 100) / 100;
  return roundedAllocated >= roundedRequired;
}
