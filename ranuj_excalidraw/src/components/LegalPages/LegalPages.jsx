import React from "react";
import "./LegalPages.css";

const COMPANY = "SketchyDraw";
const SUPPORT_EMAIL = "support@sketchydraw.com";

function LegalLayout({ title, children }) {
    return (
        <div className="legal-page">
            <div className="legal-header">
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = "/";
                    }}
                    className="legal-back"
                >
                    ← Back to SketchyDraw
                </button>

                <h1>{title}</h1>
                <p>Last updated: May 15, 2026</p>
            </div>

            <div className="legal-card">{children}</div>
        </div>
    );
}

export function TermsPage() {
    return (
        <LegalLayout title="Terms and Conditions">
            <p>
                Welcome to {COMPANY}. By accessing or using our website, application,
                and services, you agree to these Terms and Conditions.
            </p>

            <h2>1. Service</h2>
            <p>
                {COMPANY} provides online drawing, sketching, saving, exporting, and
                related digital features. The service is provided as a digital product.
            </p>

            <h2>2. User Account</h2>
            <p>
                Users are responsible for maintaining the confidentiality of their login
                credentials and all activity under their account.
            </p>

            <h2>3. Payments</h2>
            <p>
                Paid features or subscription plans may be made available through
                third-party payment providers such as Cashfree. The plan price, duration,
                and available features will be shown before payment.
            </p>

            <h2>4. Acceptable Use</h2>
            <p>
                Users must not misuse the platform, attempt unauthorized access, upload
                harmful content, disrupt the service, or use the platform for illegal
                activity.
            </p>

            <h2>5. Availability</h2>
            <p>
                We try to keep the service available and reliable, but we do not
                guarantee uninterrupted access at all times. Maintenance, updates, or
                technical issues may affect availability.
            </p>

            <h2>6. Changes</h2>
            <p>
                We may update, improve, suspend, or discontinue parts of the service when
                required.
            </p>

            <h2>7. Contact</h2>
            <p>
                For questions, contact us at{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
        </LegalLayout>
    );
}

export function PrivacyPolicyPage() {
    return (
        <LegalLayout title="Privacy Policy">
            <p>
                This Privacy Policy explains how {COMPANY} collects, uses, and protects
                user information.
            </p>

            <h2>1. Information We Collect</h2>
            <p>
                We may collect your name, email address, login details, payment status,
                drawing metadata, saved drawing data, device/browser information, and
                basic usage activity.
            </p>

            <h2>2. How We Use Information</h2>
            <p>
                We use information to provide login, save drawings, manage subscriptions,
                process payments, prevent abuse, improve service quality, and provide
                customer support.
            </p>

            <h2>3. Payments</h2>
            <p>
                Payments may be processed through Cashfree or other third-party payment
                providers. We do not store your card, UPI, net banking, or wallet
                credentials on our servers.
            </p>

            <h2>4. Data Security</h2>
            <p>
                We use reasonable technical and organizational measures to protect user
                information. However, no online service can guarantee absolute security.
            </p>

            <h2>5. Data Sharing</h2>
            <p>
                We do not sell user data. We may share limited information with payment,
                hosting, analytics, or security service providers only when needed to run
                the service.
            </p>

            <h2>6. Contact</h2>
            <p>
                For privacy-related questions, email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
        </LegalLayout>
    );
}

export function RefundPolicyPage() {
    return (
        <LegalLayout title="Refund Policy">
            <p>
                {COMPANY} provides digital subscription-based services. Since access to
                digital features may be activated immediately after payment, refunds are
                generally not provided once the plan is activated.
            </p>

            <h2>1. Eligible Refund Cases</h2>
            <p>
                Refunds may be considered in cases of duplicate payment, failed
                activation after successful payment, or a technical issue where the paid
                service could not be provided.
            </p>

            <h2>2. Non-Refundable Cases</h2>
            <p>
                Refunds are generally not provided for change of mind, accidental
                purchase, unused subscription period, or partial usage of paid features.
            </p>

            <h2>3. Refund Timeline</h2>
            <p>
                Approved refunds may take 5–10 business days depending on the payment
                provider and bank processing time.
            </p>

            <h2>4. Contact</h2>
            <p>
                For refund requests, contact{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your
                registered email and payment reference.
            </p>
        </LegalLayout>
    );
}

export function CancellationPolicyPage() {
    return (
        <LegalLayout title="Cancellation Policy">
            <p>
                Users may stop using the service at any time. For subscription plans,
                cancellation rules depend on the plan type.
            </p>

            <h2>1. Subscription Cancellation</h2>
            <p>
                If recurring billing is enabled, users can request cancellation before
                the next billing cycle. Access may remain available until the end of the
                paid period.
            </p>

            <h2>2. No Partial Refund</h2>
            <p>
                Partial refunds are generally not provided for unused subscription time
                unless required by law or approved by our support team.
            </p>

            <h2>3. Contact</h2>
            <p>
                For cancellation support, email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
        </LegalLayout>
    );
}

export function DeliveryPolicyPage() {
    return (
        <LegalLayout title="Delivery Policy">
            <p>
                {COMPANY} is a digital product. No physical shipping is involved.
            </p>

            <h2>1. Digital Delivery</h2>
            <p>
                After successful payment, paid features or subscription access are
                usually activated immediately or within a short time.
            </p>

            <h2>2. Access Issue</h2>
            <p>
                If payment is successful but access is not activated, contact support
                with your registered email and payment reference.
            </p>

            <h2>3. Contact</h2>
            <p>
                Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
        </LegalLayout>
    );
}

export function ContactUsPage() {
    return (
        <LegalLayout title="Contact Us">
            <p>
                For support, payment, refund, cancellation, or account-related queries,
                contact us using the details below.
            </p>

            <h2>Email</h2>
            <p>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>

            <h2>Business</h2>
            <p>{COMPANY}</p>

            <h2>Support Hours</h2>
            <p>Monday to Saturday, 10:00 AM to 6:00 PM IST.</p>
        </LegalLayout>
    );
}