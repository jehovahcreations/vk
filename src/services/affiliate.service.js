const userRepository = require("../repositories/user.repository");
const affiliateRepository = require("../repositories/affiliate.repository");
const commissionService = require("./commission.service");

function getTierFromCommission(commissionPercent) {
  const value = Number(commissionPercent || 0);
  if (value >= 20) return "Gold";
  if (value >= 10) return "Silver";
  return "Starter";
}

async function getAffiliateDashboard({ userId, appOrigin }) {
  const [user, earnings, referralCounts, paidReferralCount, salesStats, recentReferrals] = await Promise.all([
    userRepository.findById(userId),
    commissionService.getUserEarnings(userId),
    affiliateRepository.getReferralCounts(userId),
    affiliateRepository.getPaidReferralCount(userId),
    affiliateRepository.getReferralSalesStats(userId),
    affiliateRepository.listRecentReferrals(userId)
  ]);

  const totalReferrals = referralCounts.totalReferrals;
  const conversionRate = totalReferrals > 0
    ? (paidReferralCount / totalReferrals) * 100
    : 0;

  const commissionPercent = Number(user?.commission_percent || 0);

  return {
    stats: {
      totalEarningsInPaise: earnings.summary.totalEarningsInPaise,
      totalReferrals,
      activeToday: referralCounts.activeToday,
      conversionRate,
      nextPayoutInPaise: earnings.summary.pendingEarningsInPaise
    },
    wallet: {
      availableInPaise: earnings.summary.availableBalanceInPaise,
      pendingInPaise: earnings.summary.pendingEarningsInPaise
    },
    referral: {
      promoCode: user?.affiliate_code || "-",
      referralLink: user?.affiliate_code ? `${appOrigin}/register?ref=${encodeURIComponent(user.affiliate_code)}` : "",
      commissionPercent,
      tier: getTierFromCommission(commissionPercent)
    },
    analytics: {
      paidOrders: salesStats.paidOrders,
      totalSalesInPaise: salesStats.totalSalesInPaise
    },
    recentReferrals
  };
}

module.exports = {
  getAffiliateDashboard
};
