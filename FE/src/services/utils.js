export const formatVND = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0 ₫';
  return Math.round(num).toLocaleString('en-US') + ' ₫';
};
