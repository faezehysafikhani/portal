import { create } from 'zustand'

interface SettingsStore {
  departments: string[]
  positions: string[]
  addDepartment: (d: string) => void
  removeDepartment: (d: string) => void
  addPosition: (p: string) => void
  removePosition: (p: string) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  departments: [],
  positions: ['مدیر سیستم'],
  addDepartment: (d) => set(state => ({ departments: [...state.departments, d] })),
  removeDepartment: (d) => set(state => ({ departments: state.departments.filter(x => x !== d) })),
  addPosition: (p) => set(state => ({ positions: [...state.positions, p] })),
  removePosition: (p) => set(state => ({ positions: state.positions.filter(x => x !== p) })),
}))