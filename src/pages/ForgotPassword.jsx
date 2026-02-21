import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { resetPassword, verifyLastPassword, updatePassword, sendOTP, verifyOTPCode } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

/**
 * Stages:
 * 1: Enter Email
 * 2: Select Verification (Last Pass or OTP)
 * 3a: Enter Last Password
 * 3b: Enter OTP
 * 4: Enter New Password
 */

export default function ForgotPassword() {
    const nav = useNavigate();
    const { t } = useLanguage();

    const [stage, setStage] = useState(1);
    const [email, setEmail] = useState("");
    const [user, setUser] = useState(null);

    const [lastPass, setLastPass] = useState("");
    const [otp, setOtp] = useState("");

    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");

    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(false);

    const showToast = (msg, duration = 3500) => {
        setToast(msg);
        setTimeout(() => setToast(""), duration);
    };

    const handleStage1 = async (e) => {
        e.preventDefault();
        if (!email) return showToast(t('enterEmail'));

        try {
            setLoading(true);
            const userData = await resetPassword(email);
            setUser(userData);
            setStage(2);
        } catch (err) {
            showToast(err.message || "Email lookup failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleChoice = async (type) => {
        if (type === 'otp') {
            try {
                setLoading(true);
                showToast("Requesting code...");
                await sendOTP(user.email);
                showToast(t('otpSent') || "Code sent successfully!");
                setStage('3b');
            } catch (err) {
                console.error("OTP Error:", err);
                showToast(err.message || "Failed to send OTP. Technical error.");
            } finally {
                setLoading(false);
            }
        } else {
            setStage('3a');
        }
    };

    const handleStage3a = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const ok = await verifyLastPassword(user.email, lastPass);
            if (ok) {
                setStage(4);
            } else {
                showToast(t('incorrectLastPass'));
            }
        } catch (err) {
            showToast("Verification failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleStage3b = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await verifyOTPCode(user.email, otp);
            setStage(4);
        } catch (err) {
            showToast(err.message || "Invalid or expired OTP");
        } finally {
            setLoading(false);
        }
    };

    const handleStage4 = async (e) => {
        e.preventDefault();
        if (newPass.length < 4) return showToast(t('passLengthError'));
        if (newPass !== confirmPass) return showToast(t('passMatchError'));

        try {
            setLoading(true);
            await updatePassword(user.email, newPass);
            showToast(t('passUpdateSuccess') || "Password updated successfully!", 2000);
            setTimeout(() => nav("/login"), 2000);
        } catch (err) {
            showToast(err.message || "Update failed.");
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (stage) {
            case 1:
                return (
                    <form onSubmit={handleStage1}>
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
                                    {loading ? (t('searching') || "Searching...") : (t('resetPasswordBtn') || "Reset Password")}
                                </button>
                            </div>
                        </div>
                    </form>
                );
            case 2:
                return (
                    <div className="item-fade column" style={{ gap: 12 }}>
                        <button className="btn btnOutline w100" onClick={() => handleChoice('pass')} disabled={loading}>
                            {t('lastPasswordVerify') || "Verify with Last Password"}
                        </button>
                        <button className="btn btnOutline w100" onClick={() => handleChoice('otp')} disabled={loading} style={{ position: 'relative' }}>
                            {loading && <span style={{ position: 'absolute', left: '10px' }}>⏳</span>}
                            📧 {loading ? "Sending..." : `Send recovery code to email (${user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")})`}
                        </button>
                    </div>
                );
            case '3a':
                return (
                    <form onSubmit={handleStage3a}>
                        <div className="item-fade">
                            <label>{t('enterLastPassword') || "Enter Last Password"}</label>
                            <input
                                type="password"
                                value={lastPass}
                                onChange={(e) => setLastPass(e.target.value)}
                                placeholder="••••••••"
                                className="input-premium"
                                required
                                disabled={loading}
                            />
                            <div className="row mt20">
                                <button className="btn btnPrimary w100" type="submit" disabled={loading}>
                                    {loading ? (t('verifying') || "Verifying...") : (t('verify') || "Verify")}
                                </button>
                            </div>
                        </div>
                    </form>
                );
            case '3b':
                return (
                    <form onSubmit={handleStage3b}>
                        <div className="item-fade">
                            <label>{t('enterOtp') || "Enter OTP"}</label>
                            <input
                                type="text"
                                maxLength="6"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="input-premium center mono"
                                style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                                required
                                disabled={loading}
                            />
                            <div className="muted small center mt10">Check your email for the 6-digit verification code.</div>
                            <div className="row mt20">
                                <button className="btn btnPrimary w100" type="submit" disabled={loading}>
                                    {loading ? "Verifying..." : (t('verifyOtp') || "Verify OTP")}
                                </button>
                            </div>
                        </div>
                    </form>
                );
            case 4:
                return (
                    <form onSubmit={handleStage4}>
                        <div className="item-fade">
                            <div style={{ marginBottom: 12 }}>
                                <label>{t('newPassword') || "New Password"}</label>
                                <input
                                    type="password"
                                    value={newPass}
                                    onChange={(e) => setNewPass(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-premium"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div>
                                <label>{t('confirmNewPassword') || "Confirm Password"}</label>
                                <input
                                    type="password"
                                    value={confirmPass}
                                    onChange={(e) => setConfirmPass(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-premium"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="row mt20">
                                <button className="btn btnPrimary w100" type="submit" disabled={loading}>
                                    {loading ? (t('updating') || "Updating...") : (t('updatePasswordBtn') || "Update Password")}
                                </button>
                            </div>
                        </div>
                    </form>
                );
            default:
                return null;
        }
    };

    return (
        <main className="page">
            <section className="single" style={{ maxWidth: 400, margin: '0 auto' }}>
                <Card
                    title={stage === 1 ? t('forgotPasswordTitle') : stage === 2 ? t('verifyIdentity') : stage === 4 ? t('setNewPassword') : t('identityLookup')}
                    subtitle={stage === 1 ? t('forgotPasswordSubtitle') : t('verifyIdentity')}
                >
                    {renderStep()}

                    <div className="center mt20">
                        <button className="btn btnGhost btnSmall" onClick={() => stage === 1 ? nav("/login") : setStage(1)} disabled={loading}>
                            {stage === 1 ? t('backToLogin') : t('startOver')}
                        </button>
                    </div>

                    <div style={{ position: 'absolute', bottom: '10px', right: '15px', opacity: 0.2, fontSize: '10px', pointerEvents: 'none' }}>
                        v1.2.0-ULTIMATE
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
