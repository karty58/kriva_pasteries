import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy policy">
      <p>This page explains what information KRIVA collects when you order and how it is used.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name, mobile number and (optionally) email address.</li>
        <li>Pickup or delivery details, including a delivery address when you choose delivery.</li>
        <li>Your order contents, cake messages and special instructions.</li>
        <li>Payment status and the transaction reference from our payment provider. We never see or store your UPI PIN, card details or OTPs.</li>
      </ul>
      <h2>How we use it</h2>
      <p>Only to prepare, confirm and fulfil your order, contact you about it, process payments and refunds, and meet legal record-keeping requirements.</p>
      <h2>Who we share it with</h2>
      <p>Our payment provider (Razorpay) to process payments, and our hosting and database providers to run this website. We do not sell your information.</p>
      <h2>Storage on your device</h2>
      <p>Your cart is saved in your browser so it survives a page refresh. The shop owner&apos;s login uses secure cookies.</p>
      <h2>Your choices</h2>
      <p>To ask about, correct or delete your information, contact KRIVA using the details on the contact page.</p>
    </PolicyPage>
  );
}
