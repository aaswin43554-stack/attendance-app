import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { loginAdmin } from "../../services/auth";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !pass.trim()) {
      setToast("Please enter email and password");
      setTimeout(() => setToast(""), 2200);
      return;
    }

    try {
      setLoading(true);
      await loginAdmin({ email: email.trim(), pass });
      nav("/admin/dashboard");
    } catch (e) {
      setToast(e?.message || "Login failed");
      setTimeout(() => setToast(""), 2200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="grid">
        <Card
          title="Admin Login"
          subtitle="Sign in to view employee status and location logs."
        >
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
                  name="admin_login_email_x"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@tronxlabs.com"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>

              <div>
                <label>Password</label>
                <input
                  name="admin_login_pass_x"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="row mt12">
              <button className="btn btnPrimary" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Login"}
              </button>
            </div>
          </form>
        </Card>

        <Card
          title="Admin Dashboard"
          subtitle="Working/Total, employee list, click to expand details."
        >
          <div className="muted small">Credentials are not displayed in UI.</div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}
