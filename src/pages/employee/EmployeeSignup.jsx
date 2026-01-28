import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { signupEmployee } from "../../services/auth";

export default function EmployeeSignup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    try {
      setLoading(true);
      await signupEmployee({ name, phone, email, pass });
      setToast("Account created. Please login.");
      setTimeout(() => {
        setToast("");
        nav("/login");
      }, 1200);
    } catch (e) {
      setToast(e.message || "Signup failed");
      setTimeout(() => setToast(""), 2200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="grid">
        <Card
          title="Employee Signup"
          subtitle="Create your account (beta). No role selection."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSignup();
            }}
            autoComplete="off"
          >
            <div className="grid2">
              <div>
                <label>Full Name</label>
                <input
                  name="emp_signup_name_x"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Aswin S"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />
              </div>

              <div>
                <label>Phone (optional)</label>
                <input
                  name="emp_signup_phone_x"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 9xxxxxxxxx"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="grid2 mt10">
              <div>
                <label>Email</label>
                <input
                  name="emp_signup_email_x"
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
                  name="emp_signup_pass_x"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="row mt12">
              <button className="btn btnPrimary" type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Account"}
              </button>
              <button
                className="btn btnGhost"
                type="button"
                onClick={() => nav("/login")}
                disabled={loading}
              >
                Back
              </button>
            </div>
          </form>
        </Card>

        <Card
          title="Privacy"
          subtitle="Geo-tag is saved only on check-in/out for attendance verification."
        >
          <div className="muted small" style={{ lineHeight: 1.7 }}>
            • Location captured only when you press a button.
            <br />
            • Address may be unavailable sometimes; lat/lng still records.
          </div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}
