function formatINR(amountInPaise) {
  const amount = Number(amountInPaise) / 100;
  return amount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

module.exports = {
  formatINR
};
