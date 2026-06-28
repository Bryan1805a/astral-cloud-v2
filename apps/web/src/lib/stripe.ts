import Stripe from "stripe";

const isPlaceholder =
  !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder";

export const stripe = isPlaceholder
  ? null
  : new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16" as any,
    });

export const IS_DEV_MODE = isPlaceholder;

export const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder";
