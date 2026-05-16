import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

// POST /api/stripe/create-checkout
router.post('/create-checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.APP_URL}/premium-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/profile`,
      metadata: { userId: req.user!.id },
      subscription_data: {
        trial_period_days: 7,
      },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/stripe/create-portal
router.post('/create-portal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await query<{ stripe_customer_id: string }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [req.user!.id]
  );

  if (!user?.stripe_customer_id) {
    res.status(404).json({ message: 'No billing account found' });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.APP_URL}/profile`,
  });

  res.json({ url: session.url });
});

// POST /api/stripe/webhook
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    res.status(400).send('Webhook signature verification failed');
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (userId && session.customer) {
        await query(
          `UPDATE users
           SET tier = 'premium', stripe_customer_id = $1, stripe_subscription_id = $2,
               daily_limit = 999, updated_at = NOW()
           WHERE id = $3`,
          [session.customer, session.subscription, userId]
        );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await query(
        `UPDATE users
         SET tier = 'free', stripe_subscription_id = NULL, daily_limit = 5, updated_at = NOW()
         WHERE stripe_customer_id = $1`,
        [sub.customer]
      );
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await query(
        "UPDATE users SET tier = 'free', daily_limit = 5, updated_at = NOW() WHERE stripe_customer_id = $1",
        [invoice.customer]
      );
      break;
    }
  }

  res.json({ received: true });
});

export default router;
