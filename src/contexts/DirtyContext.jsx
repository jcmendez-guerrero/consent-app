import { createContext, useContext, useState } from 'react';

const DirtyContext = createContext(null);

export function DirtyProvider({ children }) {
  const [dirty, setDirty] = useState(false);
  return <DirtyContext.Provider value={{ dirty, setDirty }}>{children}</DirtyContext.Provider>;
}

export function useDirty() {
  const ctx = useContext(DirtyContext);
  if (!ctx) throw new Error('useDirty must be used inside DirtyProvider');
  return ctx;
}
