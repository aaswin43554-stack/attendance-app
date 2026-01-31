import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Toast from "../ui/Toast";
import { login } from "../services/auth";

export default function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [toast, setToast] = useState("");
    const [loading, setLoading] = useState(false);

    const onLogin = async () => {
        try {
            setLoading(true);
            const user = await login({ email, pass });

            if (user.role === "admin") {
                nav("/admin/dashboard");
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
                <Card title="Login" subtitle="Sign in to access your dashboard.">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onLogin();
                        }}
                        autoComplete="off"
                    >
                        <div className="grid2">
                            <div>
                                <label>Email</label>
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
                                <label>Password</label>
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
                                {loading ? "Signing in..." : "Login"}
                            </button>
                        </div>
                    </form>

                    <div className="hr" />

                    <div className="muted small">
                        New employee?{" "}
                        <button className="linkBtn" onClick={() => nav("/employee/signup")}>
                            Create an account
                        </button>
                    </div>
                </Card>

                <Card
                    title="Attendance System"
                    subtitle="One portal for everyone."
                >
                    <div className="muted small" style={{ lineHeight: 1.7 }}>
                        • Employees can mark attendance and view logs.
                        <br />
                        • Admins can monitor team status and location.
                        <br />
                        • Secure and automated tracking.
                    </div>
                </Card>
            </section>

            <Toast message={toast} />
        </main>
    );
}
