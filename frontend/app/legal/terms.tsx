import React from "react";

import LegalLayout, { LegalSection } from "@/src/components/LegalLayout";

const SECTIONS: LegalSection[] = [
  {
    heading: "Acceptance of terms",
    body: "By creating an account or using Omega's Kitchen, you agree to these Terms and Conditions. If you do not agree, please do not use the app.",
  },
  {
    heading: "The service",
    body: "Omega's Kitchen is a pre-order, first-in-first-out home kitchen. A fresh menu is posted daily, and you may also send custom 'wish' requests which the kitchen may approve with a price or decline. Orders require a minimum preparation time, shown in the app, before they are ready.",
  },
  {
    heading: "Orders and payment",
    body: "Payment is made by cash at pickup; online payment is not yet available. You may hold one active order in the queue at a time. Prices are as listed at the time you order. The kitchen may decline, cancel, or adjust an order where an item becomes unavailable.",
  },
  {
    heading: "Cancellations",
    body: "You may cancel an order while it is still in the queue and has not started cooking. Once preparation has begun, an order can no longer be cancelled from the app. Cancelled menu items are returned to availability.",
  },
  {
    heading: "Your account and conduct",
    body: "You agree to provide accurate information, including a working phone number for order confirmation, and to keep your login secure. Misuse of the service — including fraudulent orders, abuse of staff, or repeated no-shows — may result in your account being disabled.",
  },
  {
    heading: "Availability",
    body: "Menu items are limited and offered on a first-come, first-served basis. The kitchen may be closed at times; when closed, new orders cannot be placed. We do not guarantee that any particular item will be available.",
  },
  {
    heading: "Food and allergens",
    body: "Food is prepared in a home kitchen that may handle common allergens such as nuts, dairy, gluten, and shellfish. If you have allergies or dietary requirements, please confirm with the kitchen before ordering. You order at your own discretion.",
  },
  {
    heading: "Limitation of liability",
    body: "The service is provided on an 'as is' basis. To the maximum extent permitted by law, Omega's Kitchen is not liable for indirect or consequential losses arising from use of the app or from delays in order preparation or pickup.",
  },
  {
    heading: "Changes to these terms",
    body: "We may update these Terms from time to time. The 'last updated' date above reflects the latest version. Continued use of the app after changes means you accept the updated Terms.",
  },
  {
    heading: "Contact",
    body: "For questions about these Terms, contact the kitchen at the phone number or email shown on your order confirmation.",
  },
];

export default function TermsScreen() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      updated="June 2026"
      intro="These Terms and Conditions govern your use of the Omega's Kitchen app and the orders you place through it."
      sections={SECTIONS}
      testID="terms-screen"
    />
  );
}
