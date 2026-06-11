import React from "react";

import LegalLayout, { LegalSection } from "@/src/components/LegalLayout";

const SECTIONS: LegalSection[] = [
  {
    heading: "Information we collect",
    body: "When you create an account we collect your name, email address, and phone number. As you use Omega's Kitchen we store your orders, custom chef requests, menu reactions, and basic activity needed to run the queue. We do not collect payment card details — orders are paid by cash at pickup.",
  },
  {
    heading: "How we use your information",
    body: "We use your details to create and secure your account, process pre-orders, run the first-in-first-out queue, and contact you on your phone number to confirm orders at pickup. We may use aggregate, non-identifying data to improve the menu and service.",
  },
  {
    heading: "Sharing",
    body: "We do not sell your personal information. Your name and phone number are shown to kitchen staff only as needed to prepare and hand over your order. In the live queue, other customers see only a masked version of your name (e.g. first name and last initial).",
  },
  {
    heading: "Data retention",
    body: "We keep your account and order history while your account is active so you can view past orders. You can ask us to delete your account and associated personal data at any time using the contact details below.",
  },
  {
    heading: "Security",
    body: "Passwords are stored only as salted hashes and never in plain text. Your session token is held in your device's secure storage. Administrator accounts can enable two-step verification (TOTP) for additional protection.",
  },
  {
    heading: "Your rights",
    body: "You may access, correct, or request deletion of your personal data, and you may withdraw consent for non-essential processing. To exercise these rights, contact us and we will respond within a reasonable period.",
  },
  {
    heading: "Children",
    body: "Omega's Kitchen is intended for adults placing food orders and is not directed at children. We do not knowingly collect personal information from children.",
  },
  {
    heading: "Changes to this policy",
    body: "We may update this Privacy Policy from time to time. Material changes will be reflected by the 'last updated' date above. Continued use of the app after changes means you accept the updated policy.",
  },
  {
    heading: "Contact",
    body: "For privacy questions or data requests, contact the kitchen at the phone number or email shown on your order confirmation.",
  },
];

export default function PrivacyScreen() {
  return (
    <LegalLayout
      title="Privacy Policy"
      updated="June 2026"
      intro="This Privacy Policy explains what information Omega's Kitchen collects, how we use it, and the choices you have."
      sections={SECTIONS}
      testID="privacy-screen"
    />
  );
}
