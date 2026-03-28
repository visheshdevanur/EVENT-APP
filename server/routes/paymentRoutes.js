const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const supabase = require('../db/supabase');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ── POST /api/payment/create-order — Create Razorpay order ──
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { teamId } = req.body;

    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    // Get team + event entry fee
    const { data: team } = await supabase
      .from('teams')
      .select('*, events(entry_fee, title)')
      .eq('id', teamId)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.payment_status === 'confirmed') {
      return res.status(400).json({ error: 'Payment already confirmed' });
    }

    const amount = Math.round((team.events?.entry_fee || 0) * 100); // Amount in paise

    if (amount <= 0) {
      // Free event — auto-confirm
      await supabase.from('teams').update({ payment_status: 'confirmed' }).eq('id', teamId);
      return res.json({ message: 'Free event — team auto-confirmed', orderId: null });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `team_${teamId}`,
      notes: { teamId, eventTitle: team.events?.title },
    });

    // Store Razorpay order ID on the team
    await supabase.from('teams').update({ razorpay_order_id: order.id }).eq('id', teamId);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ── POST /api/payment/webhook — Razorpay Webhook ──
// NOTE: This endpoint must receive the RAW body for HMAC verification.
//       Express raw body parsing is configured in server.js for this route.
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // 1) Verify HMAC-SHA256 signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('⚠ Webhook signature mismatch');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    // We only care about payment.captured
    if (event !== 'payment.captured') {
      return res.json({ status: 'ignored', event });
    }

    const payment = payload.payment.entity;
    const orderId = payment.order_id;

    // 2) Find the team by razorpay_order_id
    const { data: team } = await supabase
      .from('teams')
      .select('id, payment_status')
      .eq('razorpay_order_id', orderId)
      .single();

    if (!team) {
      console.warn('⚠ No team found for order', orderId);
      return res.json({ status: 'no_team_found' });
    }

    // 3) Idempotency — skip if already confirmed
    if (team.payment_status === 'confirmed') {
      return res.json({ status: 'already_confirmed' });
    }

    // 4) Update team status to confirmed
    await supabase
      .from('teams')
      .update({ payment_status: 'confirmed', payment_id: payment.id })
      .eq('id', team.id);

    console.log(`✅ Payment confirmed for team ${team.id}`);

    // TODO: Trigger confirmation email to team members via Nodemailer

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── POST /api/payment/verify — Client-side verification (backup) ──
router.post('/verify', requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Update team
    const { data: team } = await supabase
      .from('teams')
      .select('id, payment_status')
      .eq('razorpay_order_id', razorpayOrderId)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.payment_status !== 'confirmed') {
      await supabase
        .from('teams')
        .update({ payment_status: 'confirmed', payment_id: razorpayPaymentId })
        .eq('id', team.id);
    }

    res.json({ status: 'ok', message: 'Payment verified' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
