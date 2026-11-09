import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Menu, X, type LucideIcon } from 'lucide-react';

type Destination<T> = { id: T; title: string; icon: LucideIcon };

export function Sidebar<T extends string>({ items, active, navigate }: {
  items: Destination<T>[];
  active: string;
  navigate: (id: T) => void;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  const links = (mobile: boolean) => <nav aria-label={mobile ? 'All destinations' : 'Main navigation'}>
    {items.map(({ id, title, icon: Icon }) => <button key={id} title={title}
      aria-label={title} aria-current={id === active ? 'page' : undefined}
      className={id === active ? 'current' : ''}
      onClick={() => { if (mobile) dialog.current?.close(); navigate(id); }}>
      <Icon size={20} aria-hidden /><span>{title}</span>
    </button>)}
  </nav>;
  return <>
    <motion.aside className="kube-rail" aria-label="Sidebar"
      animate={{ width: hover || focus ? 210 : 70 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}>
      <button className="brand" aria-label="Kube home" onClick={() => navigate(items[0].id)}>
        <img src="./logo.png" alt="" /><span>Kube</span>
      </button>
      {links(false)}
    </motion.aside>
    <button className="drawer-trigger" aria-label="Open navigation" onClick={() => dialog.current?.showModal()}><Menu /></button>
    <dialog ref={dialog} aria-label="Navigation" className="kube-drawer" onClick={e => { if (e.target === dialog.current) dialog.current.close(); }}>
      <div className="drawer-heading select-none"><img src="./logo.png" alt="" /><strong>Kube</strong>
        <button autoFocus aria-label="Close navigation" onClick={() => dialog.current?.close()}><X /></button></div>
      {links(true)}
    </dialog>
  </>;
}
