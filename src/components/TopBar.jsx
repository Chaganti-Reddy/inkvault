import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from './Logo.jsx';
import { usePdf } from '../context/PdfContext.jsx';
import { getTheme, setTheme } from '../lib/theme.js';
import { LuShieldCheck, FiSun, FiMoon } from '../ui/icons.js';

export default function TopBar() {
  const { t } = useTranslation();
  const { fileName } = usePdf();
  const [theme, setThemeState] = useState(getTheme());

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <Logo size={26} />
        <span className="brand-name">{t('brand.name')}</span>
        <span className="brand-tag">{t('brand.tagline')}</span>
      </Link>

      <div className="topbar-right">
        {fileName && <span className="file-chip" title={fileName}>{fileName}</span>}
        <span className="privacy-badge" title={t('nav.privacyNote')}>
          <LuShieldCheck /> {t('nav.privacyNote')}
        </span>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <FiSun /> : <FiMoon />}
        </button>
      </div>
    </header>
  );
}
