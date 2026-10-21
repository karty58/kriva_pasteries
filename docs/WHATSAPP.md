# WhatsApp ordering

## What it does

"Order on WhatsApp" appears on product pages, the cart and the custom-cakes page. It opens `https://wa.me/<KRIVA number>?text=<message>` with a pre-filled, URL-encoded message containing:

- an enquiry reference (e.g. `ENQ-7K3P9Q`) to help match the conversation;
- each product with size, flavour, quantity and line price;
- cake messages and instructions;
- the subtotal as shown on the website;
- preferred pickup/delivery and requested date, when given;
- a request for KRIVA to confirm availability, final price and payment.

The number comes from **/admin/settings → WhatsApp business number**. Until it is set, the buttons are replaced by a note — no number is ever invented.

## What it does not do

- Opening WhatsApp does **not** send the message; the customer still taps Send.
- It does **not** create an order in the database, reserve stock or take payment.
- WhatsApp enquiries never appear as paid or confirmed website orders.

Customers are told this next to every WhatsApp button. Payment is arranged in the chat (for example a Razorpay Payment Link — see PAYMENTS.md).

## Automatic sync into the dashboard (future option)

Getting WhatsApp orders into the dashboard automatically requires the official **WhatsApp Business Platform (Cloud API)** from Meta:

1. A Meta Business account, verified business, and a phone number registered to the Cloud API (that number can't be used in the regular WhatsApp Business app at the same time).
2. A webhook endpoint in this app that receives incoming messages (signature-verified with the app secret).
3. A parser or a structured flow (WhatsApp Flows / interactive messages) to turn messages into order requests, plus owner review before they become orders.
4. Message templates approved by Meta for outgoing notifications, and per-conversation pricing from Meta.

This is a separate project; the current click-to-chat links work with KRIVA's existing WhatsApp or WhatsApp Business app.
