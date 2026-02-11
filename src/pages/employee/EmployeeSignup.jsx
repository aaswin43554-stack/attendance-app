import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../ui/Card";
import Toast from "../../ui/Toast";
import { signupEmployee } from "../../services/auth";
import { useLanguage } from "../../context/LanguageContext";

export default function EmployeeSignup() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const onSignup = async () => {
    try {
      setLoading(true);
      await signupEmployee({ name, phone, email, pass });
      setToast(t('toastSignupSuccess'));
      setTimeout(() => {
        setToast("");
        nav("/login");
      }, 1200);
    } catch (e) {
      setToast(e.message || t('signupFailed'));
      setTimeout(() => setToast(""), 2200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="grid">
        <Card
          title={t('signupTitle')}
          subtitle={t('signupSubtitle')}
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
                <label>{t('fullName')}</label>
                <input
                  name="emp_signup_name_x"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('fullNamePlaceholder')}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />
              </div>

              <div>
                <label>{t('phoneOptional')}</label>
                <input
                  name="emp_signup_phone_x"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="grid2 mt10">
              <div>
                <label>{t('email')}</label>
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
                <label>{t('password')}</label>
                <input
                  name="emp_signup_pass_x"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="row mt12">
              <button className="btn btnPrimary" type="submit" disabled={loading}>
                {loading ? t('creating') : t('createAccountBtn')}
              </button>
              <button
                className="btn btnGhost"
                type="button"
                onClick={() => nav("/login")}
                disabled={loading}
              >
                {t('back')}
              </button>
            </div>
          </form>
        </Card>

        <Card
          title={t('privacyTitle')}
          subtitle={t('privacySubtitle')}
        >
          <div className="muted small" style={{ lineHeight: 1.7 }}>
            • {t('privacyPoint1')}
            <br />
            • {t('privacyPoint2')}
          </div>
        </Card>
      </section>

      <Toast message={toast} />
    </main>
  );
}
