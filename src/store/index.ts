import { create } from 'zustand';

interface AppState {
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  // Note: Pages, Conversations, and Messages will be observed directly via WatermelonDB's withObservables
}

export const useAppStore = create<AppState>((set) => ({
  selectedPageId: null,
  setSelectedPageId: (id) => set({ selectedPageId: id }),
}));
