import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of ordering">
      <h2>Orders</h2>
      <p>Submitting an order on the website sends a request to KRIVA. An order is confirmed only when KRIVA confirms it; the order page shows its current status.</p>
      <p>WhatsApp messages are enquiries. They become orders only after KRIVA replies to confirm them.</p>
      <h2>Prices</h2>
      <p>Prices are in Indian rupees (INR). The amount charged is the total calculated by our system at checkout. Custom designs are priced after KRIVA reviews your request.</p>
      <h2>Pickup and delivery</h2>
      <p>Requested dates and times depend on preparation time and shop availability and are confirmed by KRIVA.</p>
      <h2>Allergens</h2>
      <p>Please tell us about any allergies before ordering. Ingredient information is shown where KRIVA has provided it.</p>
      <h2>Payments</h2>
      <p>Online payments are processed by Razorpay. An order is marked paid only after the payment provider confirms it.</p>
    </PolicyPage>
  );
}
