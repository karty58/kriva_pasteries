import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = { title: "Cancellation & refund policy" };

export default function RefundPolicyPage() {
  return (
    <PolicyPage title="Cancellation &amp; refund policy">
      <p>[KRIVA to complete: cancellation window, e.g. how many hours before pickup an order can be cancelled.]</p>
      <h2>If KRIVA cannot accept your order</h2>
      <p>If we cannot fulfil an order you have already paid for, we cancel it and refund the full amount to your original payment method.</p>
      <h2>Refund timing</h2>
      <p>Refunds are issued through our payment provider. The time taken for the money to reach your account depends on your bank or UPI app.</p>
      <h2>Custom cakes</h2>
      <p>[KRIVA to complete: policy for custom cakes once ingredients or decorations have been prepared.]</p>
      <h2>Quality concerns</h2>
      <p>[KRIVA to complete: how customers should report a problem with an order and what remedies are offered.]</p>
    </PolicyPage>
  );
}
