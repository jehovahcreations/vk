const commissionRepository = require("../repositories/commission.repository");

async function creditReferralCommission({ purchaseOrderId, paymentId, client }) {
  return commissionRepository.creditCommissionForPaidOrder({
    purchaseOrderId,
    paymentId,
    client
  });
}

async function getUserEarnings(userId) {
  const [summary, commissions] = await Promise.all([
    commissionRepository.getUserEarningsSummary(userId),
    commissionRepository.listUserCommissions(userId)
  ]);

  return {
    summary: {
      totalEarningsInPaise: Number(summary?.total_earnings_in_paise || 0),
      creditedEarningsInPaise: Number(summary?.credited_earnings_in_paise || 0),
      pendingEarningsInPaise: Number(summary?.pending_earnings_in_paise || 0),
      totalCommissions: Number(summary?.total_commissions || 0)
    },
    commissions
  };
}

async function getAdminCommissionReport() {
  const [stats, commissions] = await Promise.all([
    commissionRepository.getAdminCommissionStats(),
    commissionRepository.listAllCommissions()
  ]);

  return {
    stats: {
      totalCommissions: Number(stats?.total_commissions || 0),
      totalCommissionAmountInPaise: Number(stats?.total_commission_amount_in_paise || 0),
      totalBeneficiaries: Number(stats?.total_beneficiaries || 0)
    },
    commissions
  };
}

module.exports = {
  creditReferralCommission,
  getUserEarnings,
  getAdminCommissionReport
};
