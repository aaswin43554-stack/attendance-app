import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { loginEmployee } from "../../services/auth";

export default function EmployeeLogin() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !pass) {
      setToast("Please enter email and password");
      setTimeout(() => setToast(""), 2200);
      return;
    }

    try {
      setLoading(true);
      await loginEmployee({ email, pass });
      nav("/employee/dashboard");
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
        <Card title="Employee Login" subtitle="Sign in to mark your attendance.">
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
                  name="emp_login_email_x"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@tronxlabs.com"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>

              <div>
                <label>Password</label>
                <input
                  name="emp_login_pass_x"
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

          <div className="hr" />

          <div className="muted small">
            New employee?{" "}
            <button className="linkBtn" type="button" onClick={() => nav("/employee/signup")}>
              Create an account
            </button>
          </div>
        </Card>

        <Card
          title="How it works"
          subtitle="Location is captured only when you press Check-in or Check-out."
        >
          <div className="muted small" style={{ lineHeight: 1.7 }}>
            • Geo-tag stores time + device + coordinates + address (if available).
            <br />
            • Admin can view working count & logs.
          </div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}
