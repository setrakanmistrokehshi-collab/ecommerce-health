import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const LAST_UPDATED = 'August 31, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ padding: 'var(--space-10) 0 var(--space-16)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={22} strokeWidth={1.8} color="var(--forest)" aria-hidden="true" />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Last updated {LAST_UPDATED}</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: 'var(--forest-deep)', marginBottom: 'var(--space-6)' }}>
          Privacy Policy
        </h1>

        <div style={{ color: 'var(--charcoal)', lineHeight: 1.75, fontSize: 15 }}>
          <p style={{ marginBottom: 'var(--space-6)' }}>
            Winners Health ("we", "us", "our") operates this website to sell health and
            wellness supplements to customers in Nigeria and beyond. This policy explains
            what personal data we collect, why, how we use it, and the rights you have over
            it under the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data
            Protection Regulation (NDPR).
          </p>

          <Section title="1. Who this applies to">
            <p>
              This policy covers anyone who visits our website, creates an account, places
              an order, or otherwise interacts with our storefront or admin systems. If
              you're under 18, please only use this site with a parent or guardian's
              involvement.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p style={{ marginBottom: 12 }}>We collect the following categories of data:</p>
            <ul style={listStyle}>
              <li><strong>Account information:</strong> name, email address, phone number, and password (stored as a salted hash, never in plain text).</li>
              <li><strong>Order and delivery information:</strong> shipping address, order history, and items purchased.</li>
              <li><strong>Payment information:</strong> we do not store your card or bank details. Payments are processed by Monnify, our licensed payment processor; we only retain the transaction reference and confirmation status.</li>
              <li><strong>Sign-in information:</strong> if you use "Sign in with Google", we receive your name, email, and profile photo from Google — we never receive your Google password.</li>
              <li><strong>Technical and usage information:</strong> IP address, browser type, device information, and pages viewed, collected automatically as you browse.</li>
              <li><strong>Cookies and tracking data:</strong> see Section 5 below.</li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <ul style={listStyle}>
              <li>To create and manage your account, and to process, fulfill, and deliver your orders.</li>
              <li>To send you order confirmations, delivery updates, and respond to customer service requests.</li>
              <li>To send you marketing communications about products, offers, and restocks — only if you've opted in, and you can unsubscribe at any time from your account's Newsletter settings or via the link in any marketing email.</li>
              <li>To detect and prevent fraud, abuse, and security incidents.</li>
              <li>To understand how our website is used, so we can improve it.</li>
              <li>To measure the effectiveness of our advertising, where you've consented to this (see Section 5).</li>
              <li>To comply with legal and tax obligations.</li>
            </ul>
          </Section>

          <Section title="4. Legal basis for processing">
            <p>
              Where NDPR requires a specific legal basis, we rely on: your <strong>consent</strong>
              {' '}(for marketing emails and non-essential cookies), the <strong>performance of a
              contract</strong> (to process and deliver an order you've placed), our{' '}
              <strong>legitimate interests</strong> (such as fraud prevention and improving our
              service), and <strong>legal obligation</strong> (such as retaining transaction
              records for tax purposes).
            </p>
          </Section>

          <Section title="5. Cookies and advertising">
            <p style={{ marginBottom: 12 }}>
              We use strictly necessary cookies to run the site — for example, to keep you
              signed in and to remember what's in your cart. These don't require consent, as
              the site cannot function without them.
            </p>
            <p style={{ marginBottom: 12 }}>
              With your consent, given via the cookie banner shown on your first visit, we
              also use the Meta Pixel and Meta's Conversions API to understand which of our
              ads led to a visit or purchase, and to measure how our website is used. This
              involves sharing limited information with Meta (Facebook/Instagram) — such as
              a cryptographically hashed version of your email address (never in plain text),
              the pages you view, and purchases you complete — so that Meta can match this
              activity to an ad you may have seen or clicked. Meta may combine this with
              other information they hold about you, subject to their own privacy policy.
            </p>
            <p>
              You can decline non-essential cookies at any time from the cookie banner, and
              no advertising or analytics cookies will be set. Declining does not affect your
              ability to browse or purchase from the site.
            </p>
          </Section>

          <Section title="6. Who we share your information with">
            <ul style={listStyle}>
              <li><strong>Monnify</strong> — to process payments.</li>
              <li><strong>Delivery and logistics partners</strong> — to fulfil and ship your order.</li>
              <li><strong>Google</strong> — only if you choose to sign in with Google.</li>
              <li><strong>Meta</strong> — only if you've consented to marketing cookies, as described in Section 5.</li>
              <li><strong>Cloud infrastructure and email providers</strong> — who host our systems and send transactional emails on our behalf, under contracts that require them to protect your data.</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              We do not sell your personal information to third parties.
            </p>
          </Section>

          <Section title="7. Data retention">
            <p>
              We retain your account and order data for as long as your account is active,
              and for a reasonable period afterward to meet our legal, tax, and accounting
              obligations. You can request deletion of your account at any time — see
              Section 8.
            </p>
          </Section>

          <Section title="8. Your rights">
            <p style={{ marginBottom: 12 }}>Under the NDPA/NDPR, you have the right to:</p>
            <ul style={listStyle}>
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate or incomplete data.</li>
              <li>Request deletion of your data, subject to our legal retention obligations.</li>
              <li>Withdraw consent for marketing or optional cookies at any time.</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Receive a copy of your data in a portable format.</li>
              <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC).</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              To exercise any of these rights, contact us using the details in Section 11.
            </p>
          </Section>

          <Section title="9. Security">
            <p>
              We use industry-standard measures to protect your data, including encrypted
              connections (HTTPS), hashed password storage, and access controls on our
              systems. No method of transmission or storage is completely secure, but we
              work to protect your information and to respond quickly if something goes wrong.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this policy from time to time. If we make material changes,
              we'll update the "Last updated" date at the top of this page and, where
              appropriate, notify you directly.
            </p>
          </Section>

          <Section title="11. Contact us">
            <p>
              If you have questions about this policy or want to exercise your data rights,
              contact us at{' '}
              <a href="mailto:privacy@winnershealth.com" style={{ color: 'var(--sage-dark)' }}>
                privacy@winnershealth.com
              </a>.
            </p>
          </Section>

          <p style={{ marginTop: 'var(--space-8)', fontSize: 13, color: 'var(--muted)' }}>
            See also our{' '}
            <Link to="/" style={{ color: 'var(--sage-dark)' }}>homepage</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--forest-deep)', marginBottom: 10 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const listStyle = { paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 };
