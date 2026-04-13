const webhookService = require("../services/webhook.service");
const { verifyWebhookSignature } = require("../utils/webhookSignature");
const { getWebhookSecret } = require("../config/razorpay");

async function handleRazorpayWebhook(req, res) {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body;

  if (!signature || !rawBody) {
    return res.status(400).json({ error: "Invalid webhook" });
  }

  const secret = await getWebhookSecret();
  const isValid = verifyWebhookSignature({
    payload: rawBody,
    signature,
    secret
  });

  if (!isValid) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody.toString("utf-8"));
  await webhookService.processEvent({ event, signature });
  return res.json({ status: "ok" });
}

module.exports = {
  handleRazorpayWebhook
};
