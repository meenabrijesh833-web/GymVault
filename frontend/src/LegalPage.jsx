import React from 'react';
import { ArrowLeft, Dumbbell, Mail, ShieldCheck } from 'lucide-react';
import { PRIVACY_VERSION, TERMS_VERSION } from './utils/legalDocuments';

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-black text-slate-950">{title}</h2>
    <div className="space-y-2 text-sm leading-7 text-slate-600">{children}</div>
  </section>
);

const Terms = () => (
  <>
    <Section title="1. Agreement and eligibility">
      <p>These Terms govern access to GymVault by gym owners, staff, and authorized representatives. By creating an account or using the service, you confirm that you can enter a binding contract, are authorized to act for the gym, and accept these Terms and the Privacy Policy.</p>
    </Section>
    <Section title="2. The service">
      <p>GymVault provides gym operations software, including member, attendance, plan, payment, communication, staff, reporting, and related administration tools. Features may change as the service evolves. We may use service providers to operate hosting, email, messaging, analytics, storage, authentication, and payment integrations.</p>
    </Section>
    <Section title="3. Accounts and security">
      <p>You must provide accurate information, keep credentials and devices secure, assign staff only the access they need, and promptly report suspected unauthorized access. You are responsible for activity performed through your account unless caused by our breach of these Terms.</p>
    </Section>
    <Section title="4. Gym and member data">
      <p>Your gym controls the member and staff data entered into GymVault. You represent that you have a lawful basis and all required notices or consents to collect, upload, use, and communicate with those individuals. You must not upload unlawful, excessive, misleading, infringing, or specially protected data unless the service expressly supports it and applicable law permits it.</p>
    </Section>
    <Section title="5. Payments and third-party services">
      <p>Payment, email, SMS, WhatsApp, and sign-in features may be provided by third parties such as Razorpay, Google, or configured messaging providers. Their terms and privacy practices also apply. GymVault does not hold card credentials and is not a bank or payment processor. You remain responsible for prices, taxes, refunds, member disputes, and regulatory obligations relating to your gym.</p>
    </Section>
    <Section title="6. Fees, trials, and cancellation">
      <p>Plan limits, billing cycles, taxes, trial duration, and renewal details are shown during purchase or in Billing settings. Unless stated otherwise, paid subscriptions renew for the selected cycle until cancelled. Cancellation stops future renewal but does not retroactively refund an elapsed billing period except where law requires it.</p>
    </Section>
    <Section title="7. Acceptable use">
      <p>You may not misuse the service, bypass access controls, probe or disrupt infrastructure, transmit malicious code, scrape without permission, send unlawful communications, impersonate others, violate intellectual property rights, or use GymVault to discriminate or cause harm. We may restrict abusive activity to protect customers and the platform.</p>
    </Section>
    <Section title="8. Availability and support">
      <p>We aim to operate GymVault reliably but do not promise uninterrupted or error-free service. Maintenance, provider outages, internet failures, emergencies, or security events may affect availability. Support channels and response times may vary by plan.</p>
    </Section>
    <Section title="9. Intellectual property">
      <p>GymVault and its software, design, documentation, and trademarks remain ours or our licensors'. You retain ownership of your gym data and grant us the limited rights needed to host, process, secure, back up, and transmit it to provide and improve the service.</p>
    </Section>
    <Section title="10. Suspension and termination">
      <p>We may suspend or terminate access for material breach, non-payment, unlawful use, security risk, or where required by law. You may stop using the service and cancel as provided in Billing settings. Data export and deletion remain subject to the Privacy Policy, applicable law, backup cycles, and legitimate record-retention duties.</p>
    </Section>
    <Section title="11. Disclaimers and liability">
      <p>To the extent permitted by law, GymVault is provided on an "as available" basis. It does not replace professional accounting, tax, legal, medical, or safety advice. Neither party is liable for indirect, incidental, special, or consequential loss. Our aggregate liability relating to the service will not exceed fees paid for the affected service during the preceding 12 months, unless applicable law prohibits that limit.</p>
    </Section>
    <Section title="12. Indemnity">
      <p>You will defend and indemnify GymVault against third-party claims arising from your gym data, unlawful communications, misuse of the service, or breach of these Terms, except to the extent caused by GymVault.</p>
    </Section>
    <Section title="13. Governing law and changes">
      <p>These Terms are governed by the laws of India. Courts with competent jurisdiction in India will resolve disputes, subject to mandatory consumer rights. We may update these Terms and will identify the effective version. Material changes may require renewed acceptance or advance notice.</p>
    </Section>
  </>
);

const Privacy = () => (
  <>
    <Section title="1. Scope and roles">
      <p>This Privacy Policy explains how GymVault handles personal data in its website and software. For gym owner account, billing, support, and platform security data, GymVault generally acts as the data fiduciary/controller. For member and staff data entered by a gym, the gym determines the purpose and GymVault generally acts as its processor/service provider.</p>
    </Section>
    <Section title="2. Data we collect">
      <p>We may process identity and contact details, account credentials, gym and branch information, staff roles, member profiles, membership and attendance records, payment references and statuses, communications, support requests, uploaded images, device and browser data, IP addresses, audit events, and service usage diagnostics.</p>
      <p>We do not intentionally collect card numbers or banking credentials through GymVault forms. Payment providers process their own payment data. Please do not enter health, biometric, government-ID, or other sensitive data unless a feature specifically requests it and you have a lawful basis.</p>
    </Section>
    <Section title="3. Why we use data">
      <p>We use data to provide and secure accounts; operate membership, attendance, billing, reporting, messaging, and support features; process subscriptions; detect abuse; troubleshoot failures; maintain audit records; comply with law; and improve service reliability and usability.</p>
    </Section>
    <Section title="4. Legal grounds and consent">
      <p>Depending on the context, processing is based on contract, consent, legitimate uses or interests, compliance with law, fraud prevention, and protection of users and the platform. Where consent is required, it should be specific and informed and may be withdrawn, without affecting processing already lawfully completed.</p>
    </Section>
    <Section title="5. Sharing and processors">
      <p>Data may be shared with hosting and database providers, payment processors, email and messaging services, identity providers, monitoring and support vendors, professional advisers, authorities where legally required, and a successor in a business transaction. Providers receive only the access reasonably needed for their service and are expected to protect the data.</p>
    </Section>
    <Section title="6. International processing">
      <p>Infrastructure or service providers may process data outside your state or country. Where required, we use contractual and organizational safeguards intended to provide an appropriate level of protection.</p>
    </Section>
    <Section title="7. Retention and deletion">
      <p>We retain data while an account is active and afterward only as needed for contractual, security, backup, dispute, tax, and legal obligations. Retention varies by record type. Deletion requests may not immediately remove encrypted backups, which expire through controlled backup cycles, or records that law requires us to retain.</p>
    </Section>
    <Section title="8. Security">
      <p>We use access controls, tenant boundaries, encryption in transit, password hashing, monitoring, rate limits, backups, and operational safeguards. No online system is risk-free. Account owners should use strong credentials, limit staff permissions, secure devices, and notify us promptly of suspected compromise.</p>
    </Section>
    <Section title="9. Your rights">
      <p>Subject to applicable law, including India&apos;s Digital Personal Data Protection framework as it becomes enforceable, individuals may request access to information about processing, correction, completion, erasure, grievance handling, withdrawal of consent, and nomination where applicable. Gym members should usually contact their gym first because the gym controls their operational records.</p>
    </Section>
    <Section title="10. Children">
      <p>GymVault is a business administration service and is not directed to children. A gym that records a minor member&apos;s data is responsible for obtaining verifiable parental or guardian consent and meeting applicable child-data duties.</p>
    </Section>
    <Section title="11. Cookies and local storage">
      <p>We use browser storage and strictly necessary technologies for authentication, security, interface preferences, installation, and service operation. The public website may also use limited diagnostics. Where law requires opt-in consent for non-essential technologies, those technologies should remain disabled until consent is obtained.</p>
    </Section>
    <Section title="12. Grievances and contact">
      <p>For privacy questions, account data requests, or grievances, email <a className="font-bold text-indigo-700 hover:underline" href="mailto:support@gymvault.com">support@gymvault.com</a>. Include enough detail to identify the account and request. We may verify identity and authority before acting.</p>
    </Section>
    <Section title="13. Policy changes">
      <p>We may update this policy as the service, providers, and law change. The effective version appears above. Material changes may be communicated in the service or require renewed acceptance.</p>
    </Section>
  </>
);

export default function LegalPage({ kind = 'privacy' }) {
  const isTerms = kind === 'terms';
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy';
  const version = isTerms ? TERMS_VERSION : PRIVACY_VERSION;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-3 font-black text-slate-950" aria-label="GymVault home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white"><Dumbbell size={18} /></span>
            GymVault
          </a>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700"><ArrowLeft size={16} /> Back to app</a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 border-b border-slate-300 pb-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase text-emerald-800"><ShieldCheck size={14} /> Legal</div>
          <h1 className="text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">Effective version: {version}</p>
        </div>
        <article className="space-y-9">{isTerms ? <Terms /> : <Privacy />}</article>
        <aside className="mt-12 border-l-4 border-amber-500 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <strong>Legal review notice:</strong> This operational policy must be reviewed by qualified counsel before public launch and whenever GymVault&apos;s legal entity, provider list, data practices, or applicable jurisdictions change.
        </aside>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-6 text-sm text-slate-500">
          <span>GymVault, India</span>
          <a href="mailto:support@gymvault.com" className="inline-flex items-center gap-2 font-bold text-indigo-700 hover:underline"><Mail size={15} /> support@gymvault.com</a>
        </footer>
      </main>
    </div>
  );
}