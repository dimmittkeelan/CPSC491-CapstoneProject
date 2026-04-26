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

// TC-06: loadBuild pre-populates all parts at once
test('TC-06: loadBuild pre-populates all parts at once', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.loadBuild({
      cpu:  { id: 'cpu-1',  name: 'Ryzen 5 5600X', price: 199, tdp: 65,  socket: 'AM4' },
      gpu:  { id: 'gpu-1',  name: 'RTX 3060',       price: 329, tdp: 170 },
      ram:  { id: 'ram-1',  name: '16GB DDR4',       price: 45,  type: 'DDR4' },
      mobo: { id: 'mobo-1', name: 'MSI B550-A Pro',  price: 129, socket: 'AM4', ramType: 'DDR4' },
      psu:  { id: 'psu-1',  name: 'EVGA 500W',       price: 49,  wattage: 500 },
    })
  })

  expect(result.current.selected.cpu.name).toBe('Ryzen 5 5600X')
  expect(result.current.selected.gpu.name).toBe('RTX 3060')
  expect(result.current.selected.ram.name).toBe('16GB DDR4')
  expect(result.current.selected.mobo.name).toBe('MSI B550-A Pro')
  expect(result.current.selected.psu.name).toBe('EVGA 500W')
})

// TC-07: loadBuild calculates total price correctly
test('TC-07: loadBuild calculates total price correctly', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.loadBuild({
      cpu:  { price: 199, tdp: 65,  socket: 'AM4' },
      gpu:  { price: 329, tdp: 170 },
      ram:  { price: 45,  type: 'DDR4' },
      mobo: { price: 129, socket: 'AM4', ramType: 'DDR4' },
      psu:  { price: 49,  wattage: 500 },
    })
  })

  expect(result.current.totalPrice).toBe(199 + 329 + 45 + 129 + 49)
})

// TC-08: loadBuild with compatible parts reports no issues
test('TC-08: loadBuild with compatible parts reports no issues', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.loadBuild({
      cpu:  { price: 199, tdp: 65,  socket: 'AM4' },
      gpu:  { price: 329, tdp: 170 },
      ram:  { price: 45,  type: 'DDR4' },
      mobo: { price: 129, socket: 'AM4', ramType: 'DDR4' },
      psu:  { price: 129, wattage: 750 },
    })
  })

  expect(result.current.issues).toEqual([])
})

// TC-09: setBudget updates the budget value
test('TC-09: setBudget updates the budget value', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  expect(result.current.budget).toBe(0)

  act(() => {
    result.current.setBudget(1000)
  })

  expect(result.current.budget).toBe(1000)
})

// TC-10: clearBuild after loadBuild resets all parts
test('TC-10: clearBuild after loadBuild resets all selected parts', () => {
  const { result } = renderHook(() => useBuild(), { wrapper })

  act(() => {
    result.current.loadBuild({
      cpu:  { price: 199, tdp: 65,  socket: 'AM4' },
      gpu:  { price: 329, tdp: 170 },
      ram:  { price: 45,  type: 'DDR4' },
      mobo: { price: 129, socket: 'AM4', ramType: 'DDR4' },
      psu:  { price: 49,  wattage: 500 },
    })
  })

  act(() => {
    result.current.clearBuild()
  })

  expect(result.current.selected.cpu).toBeNull()
  expect(result.current.selected.gpu).toBeNull()
  expect(result.current.totalPrice).toBe(0)
})