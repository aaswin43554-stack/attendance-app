import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "../services/storage";
import { logout } from "../services/auth";
import { useLanguage } from "../context/LanguageContext";

export default function TopNav() {
  const nav = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef(null);

  const go = (path) => nav(path);

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
          tronXlabs <small>Beta</small>
        </div>

        <div className="navLinks">
          <div className="dropdown" ref={langRef}>
            <button
              className="lang-btn"
              onClick={() => setIsLangOpen(!isLangOpen)}
            >
              <span className="icon">🌍</span>
              <span className="label">{lang.toUpperCase()}</span>
              <span className={`chevron ${isLangOpen ? 'open' : ''}`}>▾</span>
            </button>

            {/* Backdrop */}
            {isLangOpen && <div className="backdrop-blur" onClick={() => setIsLangOpen(false)} />}

            {isLangOpen && (
              <div className="popover-modal active">
                <div className="popover-header">
                  <h3>{t('language') || 'Select Language'}</h3>
                </div>
                <div className="popover-list">
                  <div
                    className={"pop-item " + (lang === 'en' ? 'selected' : '')}
                    onClick={() => { setLang('en'); setIsLangOpen(false); }}
                  >
                    <span className="flag">🇺🇸</span>
                    <span className="name">English</span>
                    {lang === 'en' && <span className="check">✓</span>}
                  </div>
                  <div
                    className={"pop-item " + (lang === 'th' ? 'selected' : '')}
                    onClick={() => { setLang('th'); setIsLangOpen(false); }}
                  >
                    <span className="flag">🇹🇭</span>
                    <span className="name">ไทย</span>
                    {lang === 'th' && <span className="check">✓</span>}
                  </div>
                  <div
                    className={"pop-item " + (lang === 'la' ? 'selected' : '')}
                    onClick={() => { setLang('la'); setIsLangOpen(false); }}
                  >
                    <span className="flag">🇱🇦</span>
                    <span className="name">ລາວ</span>
                    {lang === 'la' && <span className="check">✓</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <button className="cta-small" onClick={onLogout}>
              {t('logout')}
            </button>
          )}

          {!isLoggedIn && (
            <button className="cta-small" onClick={() => go("/login")}>
              {t('login')}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .lang-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.08);
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
          position: relative;
          z-index: 1001;
        }
        .lang-btn:hover {
          background: #f8fafc;
          border-color: var(--primary);
        }
        .lang-btn .icon { font-size: 16px; }
        .lang-btn .label { font-size: 13px; font-weight: 700; color: var(--text); }
        .lang-btn .chevron { 
          font-size: 14px; 
          color: var(--muted2);
          transition: transform 0.2s;
        }
        .lang-btn .chevron.open { transform: rotate(180deg); }

        .backdrop-blur {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(4px);
          z-index: 1000;
          animation: fadeBackdrop 0.3s ease-out;
        }

        .popover-modal {
          position: absolute;
          right: 0;
          top: calc(100% + 12px);
          width: 240px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          z-index: 1001;
          overflow: hidden;
          padding: 12px;
          border: 1px solid rgba(0,0,0,0.05);
          transform-origin: top right;
          animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .popover-header {
          padding: 8px 12px 12px;
        }
        .popover-header h3 {
          margin: 0;
          font-size: 14px;
          color: var(--muted2);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .popover-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pop-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pop-item:hover {
          background: #f1f5f9;
        }
        .pop-item.selected {
          background: rgba(37, 99, 235, 0.08);
        }
        .pop-item .flag { font-size: 20px; }
        .pop-item .name { flex: 1; font-size: 15px; font-weight: 500; color: var(--text); }
        .pop-item .check { color: var(--primary); font-weight: 900; }
        .pop-item.selected .name { color: var(--primary); font-weight: 700; }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes fadeBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .cta-small {
          background: var(--primary);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
          z-index: 1001;
          position: relative;
        }
        .cta-small:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
          background: var(--primary2);
        }
      `}</style>
    </header>
  );
}
