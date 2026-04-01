import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type ThemeMode = "light" | "dark";

type UiStore = {
  isSidebarOpen: boolean;
  theme: ThemeMode;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      theme: "light",
      openSidebar: () => set({ isSidebarOpen: true }),
      closeSidebar: () => set({ isSidebarOpen: false }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setTheme: (theme) => set({ theme })
    }),
    {
      name: "secureid-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme })
    }
  )
);
