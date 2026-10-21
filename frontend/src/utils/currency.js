/**
 * Currency utility for formatting amounts in Ethiopian Birr (ETB).
 */
export const formatETB = (amount) => {
  if (amount === null || amount === undefined || amount === '') return 'ETB 0.00';
  const num = Number(amount);
  if (isNaN(num)) return 'ETB 0.00';
  return `ETB ${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatPrice = formatETB;
export default formatETB;
