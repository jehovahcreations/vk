const refundRepository = require("../repositories/refund.repository");

async function listRefunds() {
  return refundRepository.listRefunds();
}

async function approveRefund(id) {
  return refundRepository.updateRefundStatus(id, "approved");
}

async function rejectRefund(id) {
  return refundRepository.updateRefundStatus(id, "rejected");
}

module.exports = {
  listRefunds,
  approveRefund,
  rejectRefund
};
