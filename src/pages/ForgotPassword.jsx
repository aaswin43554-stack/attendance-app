import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { useLanguage } from "../context/LanguageContext";
import { requestCustomOTPReset } from "../services/auth";

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
        if (!email) return showToast(t('enterEmail') || "Please enter your email");

        try {
            setLoading(true);

            // Trigger custom OTP reset flow
            await requestCustomOTPReset(email);

            showToast(t('otpSent') || "Reset code sent! Redirecting...");
            setSubmitted(true);

            // Navigate to OTP verification page after a short delay
            setTimeout(() => {
                nav(`/reset-password-otp?email=${encodeURIComponent(email)}`);
            }, 2000);
        } catch (err) {
            console.error("❌ Reset Request Error:", err);
            // Surface specific error from backend if available
            const errorMsg = err.message || "Failed to send reset code. Please try again.";
            showToast(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="page">
            <section className="single" style={{ maxWidth: 400, margin: '0 auto' }}>
                <Card
                    title={t('forgotPasswordTitle') || "Forgot Password"}
                    subtitle={submitted ? "Email Sent" : (t('forgotPasswordSubtitle') || "Enter your email to receive a reset code")}
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
                                        {loading ? (t('sending') || "Sending...") : (t('resetPasswordBtn') || "Send Reset Code")}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="item-fade center">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
                            <p style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
                                If an account exists for <strong>{email}</strong>, you will receive an email with a 6-digit verification code shortly.
                            </p>
                            <div className="loader-container">
                                <div className="loader"></div>
                                <p className="muted">Redirecting you...</p>
                            </div>
                        </div>
                    )}

                    {!submitted && (
                        <div className="center mt20">
                            <button className="btn btnGhost btnSmall" onClick={() => nav("/login")} disabled={loading}>
                                {t('backToLogin') || "Back to Login"}
                            </button>
                        </div>
                    )}
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
                .center { text-align: center; }
                .loader-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                }
                .loader {
                  border: 3px solid #f3f3f3;
                  border-top: 3px solid var(--primary);
                  border-radius: 50%;
                  width: 24px;
                  height: 24px;
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                .muted { color: #64748b; font-size: 0.9rem; }
            `}</style>
            <Toast message={toast} />
        </main>
    );
}
