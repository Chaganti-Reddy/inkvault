import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePdf } from '../context/PdfContext.jsx';
import { buildPdf, downloadBytes } from '../lib/pdfops.js';
import { protectBytes } from '../lib/protect.js';
import { FiLock, FiDownload } from '../ui/icons.js';

export default function ProtectPanel() {
  const { t } = useTranslation();
  const { pages, sources, annotations, formValues, metadata, fileName } = usePdf();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [restrict, setRestrict] = useState({ print: false, copy: false, edit: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && pw !== confirm;
  const hasRestriction = restrict.print || restrict.copy || restrict.edit;
  // Either set an open password (matched) or just apply restrictions.
  const canGo = !busy && ((pw.length >= 3 && pw === confirm) || (pw.length === 0 && hasRestriction));

  const toggle = (k) => setRestrict((r) => ({ ...r, [k]: !r[k] }));

  const run = async () => {
    setBusy(true); setError(''); setDone(false);
    try {
      const base = await buildPdf(pages, sources, annotations, formValues, metadata);
      const encrypted = await protectBytes(base, { userPassword: pw, restrict });
      downloadBytes(encrypted, (fileName || 'document').replace(/\.pdf$/i, '') + '-protected.pdf');
      setDone(true);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ocr-panel">
      <div className="ocr-card">
        <FiLock className="ocr-icon" />
        <h2>{t('protect.title')}</h2>
        <p className="ocr-sub">{t('protect.sub')}</p>

        <label className="ocr-lang">
          {t('protect.password')}
          <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setDone(false); }} placeholder={t('protect.passwordPlaceholder')} />
        </label>
        <label className="ocr-lang">
          {t('protect.confirm')}
          <input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setDone(false); }} />
        </label>
        {mismatch && <div className="pw-warn">{t('protect.mismatch')}</div>}

        <div className="restrict-box">
          <div className="restrict-title">{t('protect.restrictTitle')}</div>
          <label className="restrict-row"><input type="checkbox" checked={restrict.print} onChange={() => toggle('print')} /> {t('protect.preventPrint')}</label>
          <label className="restrict-row"><input type="checkbox" checked={restrict.copy} onChange={() => toggle('copy')} /> {t('protect.preventCopy')}</label>
          <label className="restrict-row"><input type="checkbox" checked={restrict.edit} onChange={() => toggle('edit')} /> {t('protect.preventEdit')}</label>
        </div>

        <button className="btn primary" onClick={run} disabled={!canGo}>
          <FiLock /> {busy ? t('protect.working') : t('protect.run')}
        </button>

        {error && <div className="error">{error}</div>}
        {done && <div className="ocr-done"><FiDownload /> {t('protect.done')}</div>}

        <p className="ocr-note">{t('protect.note')}</p>
      </div>
    </div>
  );
}
