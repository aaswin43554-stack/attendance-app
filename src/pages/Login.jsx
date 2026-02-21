import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { login } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

export default function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(false);
    const { t } = useLanguage();

    const onLogin = async () => {
        try {
            setLoading(true);
            const user = await login({ email, pass });

            if (user.role === "admin") {
                nav("/admin/dashboard");
            } else if (user.role === "team_leader") {
                nav("/team-leader/dashboard");
            } else {
                nav("/employee/dashboard");
            }
        } catch (e) {
            setToast(e.message || "Login failed");
            setTimeout(() => setToast(""), 2200);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="page">
            <section className="grid">
                <Card title={t('loginTitle')} subtitle={t('loginSubtitle')}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onLogin();
                        }}
                        autoComplete="off"
                    >
                        <div className="grid2">
                            <div>
                                <label>{t('email')}</label>
                                <input
                                    name="login_email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@tronxlabs.com"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    required
                                />
                            </div>

                            <div>
                                <label>{t('password')}</label>
                                <input
                                    name="login_pass"
                                    type="password"
                                    value={pass}
                                    onChange={(e) => setPass(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    required
                                />
                            </div>
                        </div>

                        <div className="row mt12">
                            <button className="btn btnPrimary" type="submit" disabled={loading}>
                                {loading ? t('loggingIn') : t('loginBtn')}
                            </button>
                            <button
                                className="btn btnGhost"
                                type="button"
                                onClick={() => nav("/employee/signup")}
                                disabled={loading}
                            >
                                {t('createAccountBtn')}
                            </button>
                        </div>
                        <div className="center mt10">
                            <button
                                className="btn btnText"
                                type="button"
                                onClick={() => nav("/forgot-password")}
                                style={{ fontSize: '0.85rem' }}
                            >
                                {t('forgotPassword') || 'Forgot Password?'}
                            </button>
                        </div>
                    </form>

                    <div className="hr" />


                </Card>

                <Card
                    title={t('portalTitle')}
                    subtitle={t('portalSubtitle')}
                >
                    <div className="muted small" style={{ lineHeight: 1.7 }}>
                        • {t('portalPoint1')}
                        <br />
                        • {t('portalPoint2')}
                        <br />
                        • {t('portalPoint3')}
                    </div>
                </Card>
            </section>

            <Toast message={toast} />
        </main>
    );
}
