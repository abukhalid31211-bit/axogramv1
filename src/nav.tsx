import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Screen = string[];

type NavState = {
  stack: Screen[];
  current: Screen;
  push: (s: Screen) => void;
  back: () => void;
  home: () => void;
  reset: (s: Screen) => void;
};

const NavContext = createContext<NavState | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([["home"]]);

  const push = useCallback((s: Screen) => {
    setStack((prev) => [...prev, s]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const home = useCallback(() => {
    setStack([["home"]]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const reset = useCallback((s: Screen) => {
    setStack([s]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <NavContext.Provider value={{ stack, current: stack[stack.length - 1], push, back, home, reset }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
