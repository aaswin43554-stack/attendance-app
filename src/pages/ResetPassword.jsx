import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { updatePassword } from "../services/auth";
import { supabase } from "../services/supabase";
import { useLanguage } from "../context/LanguageContext";

export default function ResetPassword() {
    const nav = useNavigate();
    const { t } = useLanguage();

    const [newPass, setNewPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
    const [email, setEmail] = useState("");
    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const showToast = (msg, duration = 3500) => {
        setToast(msg);
        setTimeout(() => setToast(""), duration);
    };

    useEffect(() => {
        // Check if we have a session (automatically handled by SB after clicking reset link)
        const checkUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) {
                    showToast("Session expired or invalid. Please request a new reset link.");
                    setTimeout(() => nav("/forgot-password"), 3000);
                } else {
                    setEmail(user.email);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Auth status error:", err);
                nav("/login");
            }
        };
        checkUser();
    }, [nav]);

    const handleReset = async (e) => {
        e.preventDefault();
        if (newPass.length < 4) return showToast(t('passLengthError') || "Password too short");
        if (newPass !== confirmPass) return showToast(t('passMatchError') || "Passwords do not match");

        try {
            setUpdating(true);
            await updatePassword(email, newPass);
            showToast(t('passUpdateSuccess') || "Password updated successfully!", 2000);

            // Log out from Supabase Auth after success (optional, but good for security)
            await supabase.auth.signOut();

            setTimeout(() => nav("/login"), 2000);
        } catch (err) {
            console.error("Update Error:", err);
            showToast(err.message || "Failed to update password.");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <main className="page center column" style={{ height: '80vh' }}>
                <div className="loader"></div>
                <p className="mt20 muted">Verifying reset session...</p>
            </main>
        );
    }

    return (
        <main className="page">
            <section className="single" style={{ maxWidth: 400, margin: '0 auto' }}>
                <Card
                    title={t('setNewPassword') || "Reset Your Password"}
                    subtitle={`Setting new password for ${email}`}
                >
                    <form onSubmit={handleReset}>
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
                                    disabled={updating}
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
                                    disabled={updating}
                                />
                            </div>
                            <div className="row mt20">
                                <button className="btn btnPrimary w100" type="submit" disabled={updating}>
                                    {updating ? (t('updating') || "Updating...") : (t('updatePasswordBtn') || "Update Password")}
                                </button>
                            </div>
                        </div>
                    </form>
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
        .loader {
          border: 4px solid #f3f3f3;
          border-top: 4px solid var(--primary);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
            <Toast message={toast} />
        </main>
    );
}
