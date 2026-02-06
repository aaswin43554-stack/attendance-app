import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../services/storage";
import { logout } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

export default function TopNav() {
  const nav = useNavigate();

  const go = (path) => nav(path);

  const { lang, setLang, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onLogout = () => {
    logout();
    nav("/login");
  };

  const s = getSession();
  const isLoggedIn = s?.type === "employee" || s?.type === "admin";

  return (
    <header className="nav">
      <div className="navInner">
        <div className="brand">
          tronXlabs <small>• Attendance Beta</small>
        </div>

        <div className="navLinks">
          <div className="dropdown" ref={langRef}>
            <button
              className="btn-icon langToggle"
              onClick={() => setIsLangOpen(!isLangOpen)}
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>⚙️</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{lang.toUpperCase()}</span>
            </button>

            {isLangOpen && (
              <div className="dropdownContent active">
                <div
                  className={"item " + (lang === 'en' ? 'active' : '')}
                  onClick={() => { setLang('en'); setIsLangOpen(false); }}
                >
                  English
                </div>
                <div
                  className={"item " + (lang === 'th' ? 'active' : '')}
                  onClick={() => { setLang('th'); setIsLangOpen(false); }}
                >
                  ไทย
                </div>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <button className="chip" onClick={onLogout} style={{ marginLeft: 8 }}>
              {t('logout')}
            </button>
          )}

          {!isLoggedIn && (
            <button className="chip" onClick={() => go("/login")} style={{ marginLeft: 8 }}>
              {t('login')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
