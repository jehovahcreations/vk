const pool = require("../config/db");

async function renderDashboard(req, res) {
  const [studentRes, resellerRes, videoRes, revenueRes, monthlyRes, paymentStatusRes, mixRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::INTEGER AS total_students
       FROM users
       WHERE role = 'student'`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_reseller = true AND is_active = true)::INTEGER AS active_resellers,
         COUNT(*) FILTER (WHERE is_reseller = true AND created_at >= NOW() - INTERVAL '7 days')::INTEGER AS new_resellers_this_week
       FROM users
       WHERE role = 'student'`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true)::INTEGER AS active_videos,
         COUNT(*) FILTER (WHERE is_active = false)::INTEGER AS inactive_videos
       FROM products
       WHERE type = 'video'`
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount_in_paise), 0)::BIGINT AS total_revenue_in_paise
       FROM purchase_orders
       WHERE internal_status = 'paid'`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount_in_paise), 0)::BIGINT AS monthly_sales_in_paise,
         COUNT(*)::INTEGER AS monthly_paid_orders
       FROM purchase_orders
       WHERE internal_status = 'paid'
         AND created_at >= date_trunc('month', NOW())`
    ),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'captured')::INTEGER AS captured,
         COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed,
         COUNT(*) FILTER (WHERE status IN ('created','authorized'))::INTEGER AS pending
       FROM payments`
    ),
    pool.query(
      `SELECT
         products.type,
         COUNT(*)::INTEGER AS purchases_count
       FROM purchase_orders
       JOIN products ON products.id = purchase_orders.product_id
       WHERE purchase_orders.internal_status = 'paid'
       GROUP BY products.type`
    )
  ]);

  let pendingPayoutAmountInPaise = 0;
  let pendingPayoutCount = 0;
  try {
    const payoutRes = await pool.query(
      `SELECT
         COALESCE(SUM(commission_amount_in_paise), 0)::BIGINT AS pending_amount_in_paise,
         COUNT(*)::INTEGER AS pending_count
       FROM referral_commissions
       WHERE status = 'pending'`
    );
    pendingPayoutAmountInPaise = Number(payoutRes.rows[0]?.pending_amount_in_paise || 0);
    pendingPayoutCount = Number(payoutRes.rows[0]?.pending_count || 0);
  } catch (error) {
    if (error.code !== "42P01") {
      throw error;
    }
  }

  const mix = mixRes.rows.reduce(
    (acc, row) => {
      acc[row.type] = Number(row.purchases_count || 0);
      return acc;
    },
    { video: 0, course: 0, plan: 0 }
  );

  return res.render("admin-dashboard", {
    adminName: req.session.user.full_name,
    stats: {
      totalStudents: Number(studentRes.rows[0]?.total_students || 0),
      activeResellers: Number(resellerRes.rows[0]?.active_resellers || 0),
      newResellersThisWeek: Number(resellerRes.rows[0]?.new_resellers_this_week || 0),
      totalVideos: Number(videoRes.rows[0]?.active_videos || 0),
      inactiveVideos: Number(videoRes.rows[0]?.inactive_videos || 0),
      totalRevenueInPaise: Number(revenueRes.rows[0]?.total_revenue_in_paise || 0),
      monthlySalesInPaise: Number(monthlyRes.rows[0]?.monthly_sales_in_paise || 0),
      monthlyPaidOrders: Number(monthlyRes.rows[0]?.monthly_paid_orders || 0),
      pendingPayoutAmountInPaise,
      pendingPayoutCount,
      paymentStatus: {
        captured: Number(paymentStatusRes.rows[0]?.captured || 0),
        failed: Number(paymentStatusRes.rows[0]?.failed || 0),
        pending: Number(paymentStatusRes.rows[0]?.pending || 0)
      },
      subscriptionMix: mix
    }
  });
}

module.exports = {
  renderDashboard
};
