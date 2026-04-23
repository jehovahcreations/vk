const commissionRepository = require("../repositories/commission.repository");
const pool = require("../config/db");

function parseAmountInPaise(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payout amount must be greater than zero.");
  }
  return Math.round(amount * 100);
}

function normalizeDateTime(value) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid payout date/time.");
  }
  return parsed;
}

async function creditReferralCommission({ purchaseOrderId, paymentId, client }) {
  return commissionRepository.creditCommissionForPaidOrder({
    purchaseOrderId,
    paymentId,
    client
  });
}

async function getUserEarnings(userId) {
  const [summary, commissions, payouts] = await Promise.all([
    commissionRepository.getUserEarningsSummary(userId),
    commissionRepository.listUserCommissions(userId),
    commissionRepository.listUserPayouts(userId)
  ]);

  return {
    summary: {
      totalEarningsInPaise: Number(summary?.total_earnings_in_paise || 0),
      creditedEarningsInPaise: Number(summary?.credited_earnings_in_paise || 0),
      pendingEarningsInPaise: Number(summary?.pending_earnings_in_paise || 0),
      paidOutInPaise: Number(summary?.paid_out_in_paise || 0),
      availableBalanceInPaise: Number(summary?.available_balance_in_paise || 0),
      totalCommissions: Number(summary?.total_commissions || 0)
    },
    commissions,
    payouts
  };
}

async function getAdminCommissionReport({ search = "", payoutStatus = "active", beneficiaryUserId = "" } = {}) {
  const [stats, commissions, beneficiaryBalances, payouts] = await Promise.all([
    commissionRepository.getAdminCommissionStats(),
    commissionRepository.listAllCommissions(),
    commissionRepository.listBeneficiaryBalances({ search }),
    commissionRepository.listRecentPayouts({
      limit: 100,
      search,
      status: payoutStatus,
      beneficiaryUserId
    })
  ]);

  return {
    stats: {
      totalCommissions: Number(stats?.total_commissions || 0),
      totalCommissionAmountInPaise: Number(stats?.total_commission_amount_in_paise || 0),
      totalBeneficiaries: Number(stats?.total_beneficiaries || 0),
      totalCreditedInPaise: Number(stats?.total_credited_in_paise || 0),
      totalPendingInPaise: Number(stats?.total_pending_in_paise || 0),
      totalPaidOutInPaise: Number(stats?.total_paid_out_in_paise || 0),
      totalAvailableBalanceInPaise: Number(stats?.total_available_balance_in_paise || 0)
    },
    commissions,
    beneficiaryBalances,
    payouts,
    filters: {
      search,
      payoutStatus,
      beneficiaryUserId
    }
  };
}

async function createManualPayout({ beneficiaryUserId, amountInInr, notes, paidAt, createdByUserId }) {
  if (!beneficiaryUserId) {
    throw new Error("Select a beneficiary user.");
  }

  const amountInPaise = parseAmountInPaise(amountInInr);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userLockResult = await client.query(
      "SELECT id FROM users WHERE id = $1 LIMIT 1 FOR UPDATE",
      [beneficiaryUserId]
    );
    if (!userLockResult.rows.length) {
      throw new Error("Beneficiary user not found.");
    }

    const availableBalance = await commissionRepository.getAvailableBalanceForUser({
      beneficiaryUserId,
      client
    });

    if (amountInPaise > availableBalance) {
      throw new Error("Payout amount exceeds available commission balance.");
    }

    const normalizedPaidAt = normalizeDateTime(paidAt);

    const payout = await commissionRepository.createManualPayout({
      beneficiaryUserId,
      amountInPaise,
      notes,
      paidAt: normalizedPaidAt,
      createdByUserId,
      client
    });

    await commissionRepository.createPayoutAudit({
      payoutId: payout.id,
      actionType: "created",
      actorUserId: createdByUserId,
      payload: {
        amount_in_paise: payout.amount_in_paise,
        paid_at: payout.paid_at,
        notes: payout.notes
      },
      client
    });

    await client.query("COMMIT");
    return payout;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateManualPayout({ payoutId, amountInInr, notes, paidAt, updatedByUserId }) {
  if (!payoutId) {
    throw new Error("Payout id is required.");
  }

  const amountInPaise = parseAmountInPaise(amountInInr);
  const normalizedPaidAt = normalizeDateTime(paidAt);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await commissionRepository.getPayoutById({
      payoutId,
      client,
      includeVoided: false
    });
    if (!existing) {
      throw new Error("Payout not found or already voided.");
    }

    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [existing.beneficiary_user_id]);

    const availableBalance = await commissionRepository.getAvailableBalanceForUser({
      beneficiaryUserId: existing.beneficiary_user_id,
      excludePayoutId: payoutId,
      client
    });

    if (amountInPaise > availableBalance) {
      throw new Error("Updated amount exceeds available commission balance.");
    }

    const updated = await commissionRepository.updateManualPayout({
      payoutId,
      amountInPaise,
      notes,
      paidAt: normalizedPaidAt,
      updatedByUserId,
      client
    });

    await commissionRepository.createPayoutAudit({
      payoutId,
      actionType: "updated",
      actorUserId: updatedByUserId,
      payload: {
        before: {
          amount_in_paise: existing.amount_in_paise,
          paid_at: existing.paid_at,
          notes: existing.notes
        },
        after: {
          amount_in_paise: updated.amount_in_paise,
          paid_at: updated.paid_at,
          notes: updated.notes
        }
      },
      client
    });

    await client.query("COMMIT");
    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function voidManualPayout({ payoutId, voidedByUserId }) {
  if (!payoutId) {
    throw new Error("Payout id is required.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await commissionRepository.getPayoutById({
      payoutId,
      client,
      includeVoided: true
    });

    if (!existing) {
      throw new Error("Payout not found.");
    }
    if (existing.is_voided) {
      throw new Error("Payout is already deleted.");
    }

    const voided = await commissionRepository.voidManualPayout({
      payoutId,
      voidedByUserId,
      client
    });

    await commissionRepository.createPayoutAudit({
      payoutId,
      actionType: "voided",
      actorUserId: voidedByUserId,
      payload: {
        amount_in_paise: voided.amount_in_paise,
        paid_at: voided.paid_at,
        notes: voided.notes
      },
      client
    });

    await client.query("COMMIT");
    return voided;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getPayoutExportRows({ search = "", payoutStatus = "all", beneficiaryUserId = "" } = {}) {
  const payouts = await commissionRepository.listRecentPayouts({
    limit: 5000,
    search,
    status: payoutStatus,
    beneficiaryUserId
  });
  return payouts;
}

module.exports = {
  creditReferralCommission,
  getUserEarnings,
  getAdminCommissionReport,
  createManualPayout,
  updateManualPayout,
  voidManualPayout,
  getPayoutExportRows
};
