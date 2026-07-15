import { create } from 'zustand'

export interface OrgPosition {
  id: string
  orgId: string
  title: string
  parentId: string | null
  color: string
}

interface OrgChartStore {
  positions: OrgPosition[]
  addPosition: (p: OrgPosition) => void
  updatePosition: (id: string, p: Partial<OrgPosition>) => void
  deletePosition: (id: string) => void
}

export const useOrgChartStore = create<OrgChartStore>((set) => ({
  positions: [
    { id: 'admin-root', orgId: '1', title: 'مدیر سیستم', parentId: null, color: '#8B1A6B' }
  ],
  addPosition: (p) => set(state => ({ positions: [...state.positions, p] })),
  updatePosition: (id, updated) => set(state => ({ positions: state.positions.map(p => p.id === id ? { ...p, ...updated } : p) })),
  deletePosition: (id) => set(state => ({ positions: state.positions.filter(p => p.id !== id) })),
}))