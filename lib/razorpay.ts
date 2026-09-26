import Razorpay from "razorpay";

let client: Razorpay | null = null;

// Created on first request, not at import — `next build` imports every route to collect page data,
// and the Razorpay constructor throws when the keys aren't set (e.g. a deploy without payment env vars).
export function getRazorpay(): Razorpay | null {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  client = new Razorpay({ key_id, key_secret });
  return client;
}
