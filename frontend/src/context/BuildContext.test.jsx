import { renderHook, act } from '@testing-library/react'
import { BuildProvider, useBuild } from './BuildContext'

const wrapper = ({ children }) => <BuildProvider>{children}</BuildProvider>

// TC-01: Initial state
test('TC-01: initial state is empty', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  expect(result.current.selected.cpu).toBeNull()
  expect(result.current.totalPrice).toBe(0)
  expect(result.current.totalWattage).toBe(0)
  expect(result.current.issues).toEqual([])
})

// TC-02: Select and remove a part
test('TC-02: selectPart and removePart work correctly', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.selectPart('cpu', { name: 'Ryzen 5 5600X', price: 199, tdp: 65, socket: 'AM4' })
  })
  expect(result.current.selected.cpu.name).toBe('Ryzen 5 5600X')

  act(() => {
    result.current.removePart('cpu')
  })
  expect(result.current.selected.cpu).toBeNull()
})

// TC-03: Clear build
test('TC-03: clearBuild resets all parts', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.selectPart('cpu', { price: 199, tdp: 65 })
    result.current.selectPart('gpu', { price: 400, tdp: 150 })
  })
  act(() => {
    result.current.clearBuild()
  })

  expect(result.current.selected.cpu).toBeNull()
  expect(result.current.totalPrice).toBe(0)
})

// TC-04: Compatibility check — socket mismatch
test('TC-04: CPU and mobo socket mismatch triggers issue', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.selectPart('cpu',  { price: 200, tdp: 65, socket: 'AM4' })
    result.current.selectPart('mobo', { price: 150, socket: 'LGA1700', ramType: 'DDR4' })
  })

  expect(result.current.issues.length).toBeGreaterThan(0)
  expect(result.current.issues[0]).toMatch(/socket/i)
})

// TC-05: PSU check
test('TC-05: PSU underpowered warning appears', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.selectPart('cpu', { price: 200, tdp: 65, socket: 'AM4' })
    result.current.selectPart('gpu', { price: 400, tdp: 300 })
    result.current.selectPart('mobo', { price: 150, socket: 'AM4', ramType: 'DDR4' })
    result.current.selectPart('psu', { price: 60, wattage: 400 })
  })

  expect(result.current.issues.some(i => i.includes('PSU'))).toBe(true)
})