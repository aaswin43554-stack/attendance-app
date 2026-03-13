import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { verifyCustomOTPReset } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPasswordOTP() {
    const nav = useNavigate();
    const [searchParams] = useSearchParams();
    const { t } = useLanguage();

    const emailFromUrl = searchParams.get("email") || "";

    const [otp, setOtp] = useState("");
    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(false);

    const showToast = (msg, duration = 3500) => {
        setToast(msg);
        setTimeout(() => setToast(""), duration);
    };

    const handleVerifyAndReset = async (e) => {
        e.preventDefault();

        if (otp.length !== 6) return showToast("Enter 6-digit code");
        if (newPass.length < 6) return showToast("Password must be at least 6 characters");
        if (newPass !== confirmPass) return showToast("Passwords do not match");

        try {
            setLoading(true);
            await verifyCustomOTPReset(emailFromUrl, otp, newPass);
            showToast("Password updated successfully!", 2000);
            setTimeout(() => nav("/login"), 2000);
        } catch (err) {
            console.error("OTP Reset Error:", err);
            showToast(err.message || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="page">
            <section className="single" style={{ maxWidth: 400, margin: '0 auto' }}>
                <Card
                    title="Enter Reset Code"
                    subtitle={`Verify code sent to ${emailFromUrl}`}
                >
                    <form onSubmit={handleVerifyAndReset}>
                        <div className="item-fade">
                            <div style={{ marginBottom: 15 }}>
                                <label>6-Digit Code</label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="input-premium center"
                                    style={{ letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                    required
                                    disabled={loading}
                                />
                            </div>

                            <div style={{ marginBottom: 12 }}>
                                <label>New Password</label>
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

                            <div style={{ marginBottom: 20 }}>
                                <label>Confirm Password</label>
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

                            <button className="btn btnPrimary w100" type="submit" disabled={loading}>
                                {loading ? "Verifying..." : "Update Password"}
                            </button>
                        </div>
                    </form>

                    <div className="center mt20">
                        <button className="btn btnGhost btnSmall" onClick={() => nav("/forgot-password")} disabled={loading}>
                            Resend Code
                        </button>
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
                .center { text-align: center; }
            `}</style>
            <Toast message={toast} />
        </main>
    );
}
