import { useEffect, useState } from 'react';
import { subscribeToasts } from '../lib/toast.js';
import { LuShieldCheck, FiX } from '../ui/icons.js';

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeToasts((t) => {
    setItems((x) => [...x, t]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3500);
  }), []);

  return (
    <div className="toaster">
      {items.map((i) => (
        <div key={i.id} className={`toast ${i.type}`}>
          {i.type === 'error' ? <FiX /> : <LuShieldCheck />}
          <span>{i.message}</span>
        </div>
      ))}
    </div>
  );
}
