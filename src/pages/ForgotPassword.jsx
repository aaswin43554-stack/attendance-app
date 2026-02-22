import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { resetPasswordLookup, requestPasswordReset } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

export default function ForgotPassword() {
    const nav = useNavigate();
    const { t } = useLanguage();

    const [email, setEmail] = useState("");
    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const showToast = (msg, duration = 3500) => {
        setToast(msg);
        setTimeout(() => setToast(""), duration);
    };

    const handleResetRequest = async (e) => {
        e.preventDefault();
        if (!email) return showToast(t('enterEmail'));

        try {
            setLoading(true);
            // 1. Optional: Check if user exists in our DB first (prevents leaking email existence if desired, but here we use it for validation)
            try {
                await resetPasswordLookup(email);
            } catch (err) {
                // If user doesn't exist in custom table, we can still try Supabase Auth or just fail here
                console.warn("User not found in custom table:", err.message);
            }

            // 2. Trigger native Supabase reset email
            await requestPasswordReset(email);

            setSubmitted(true);
            showToast(t('otpSent') || "Reset link sent to your email!");
        } catch (err) {
            console.error("Reset Error:", err);
            showToast(err.message || "Failed to send reset link.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="page">
            <section className="single" style={{ maxWidth: 400, margin: '0 auto' }}>
                <Card
                    title={t('forgotPasswordTitle') || "Forgot Password"}
                    subtitle={submitted ? "Email Sent" : (t('forgotPasswordSubtitle') || "Enter your email to receive a reset link")}
                >
                    {!submitted ? (
                        <form onSubmit={handleResetRequest}>
                            <div className="item-fade">
                                <label>{t('email') || "Email"}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input-premium"
                                    required
                                    disabled={loading}
                                />
                                <div className="row mt20">
                                    <button className="btn btnPrimary w100" type="submit" disabled={loading}>
                                        {loading ? (t('sending') || "Sending...") : (t('resetPasswordBtn') || "Send Reset Link")}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="item-fade center">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
                                If an account exists for <strong>{email}</strong>, you will receive an email with instructions to reset your password shortly.
                            </p>
                            <button className="btn btnPrimary w100" onClick={() => nav("/login")}>
                                {t('backToLogin') || "Back to Login"}
                            </button>
                        </div>
                    )}

                    {!submitted && (
                        <div className="center mt20">
                            <button className="btn btnGhost btnSmall" onClick={() => nav("/login")} disabled={loading}>
                                {t('backToLogin') || "Back to Login"}
                            </button>
                        </div>
                    )}

                    <div style={{ position: 'absolute', bottom: '10px', right: '15px', opacity: 0.2, fontSize: '10px', pointerEvents: 'none' }}>
                        v1.2.1-SUPA
                    </div>
                </Card>
            </section>

            <style>{`
        .input-premium {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 2px solid var(--border);
          background: var(--bg);
          font-size: 1rem;
          transition: all 0.2s;
        }
        .input-premium:focus {
          border-color: var(--primary);
          outline: none;
          box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
        }
        .item-fade {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .w100 { width: 100%; }
        .mt20 { margin-top: 20px; }
      `}</style>
            <Toast message={toast} />
        </main>
    );
}
