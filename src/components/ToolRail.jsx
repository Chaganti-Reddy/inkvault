import { useTranslation } from 'react-i18next';
import { FiEye, FiGrid, FiEdit3, FiEyeOff, FiType, FiSearch, FiMinimize2, FiLock, FiDroplet } from '../ui/icons.js';

// Left tool switcher. Tools are added here as they ship.
const TOOLS = [
  { key: 'view', Icon: FiEye },
  { key: 'organize', Icon: FiGrid },
  { key: 'annotate', Icon: FiEdit3 },
  { key: 'redact', Icon: FiEyeOff },
  { key: 'forms', Icon: FiType },
  { key: 'stamp', Icon: FiDroplet },
  { key: 'ocr', Icon: FiSearch },
  { key: 'compress', Icon: FiMinimize2 },
  { key: 'protect', Icon: FiLock },
];

export default function ToolRail({ tool, setTool }) {
  const { t } = useTranslation();
  return (
    <nav className="tool-rail">
      {TOOLS.map(({ key, Icon }) => (
        <button
          key={key}
          className={`tool-btn ${tool === key ? 'on' : ''}`}
          onClick={() => setTool(key)}
          title={t(`tool.${key}`)}
        >
          <Icon />
          <span>{t(`tool.${key}`)}</span>
        </button>
      ))}
    </nav>
  );
}
