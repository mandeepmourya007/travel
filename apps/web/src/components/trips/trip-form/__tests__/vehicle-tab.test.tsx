import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { renderWithQuery } from '@/test/test-utils'
import { VehicleTab } from '../vehicle-tab'
import type { CreateVehicleDto } from '@shared/types/vehicle.types'
import type { SeatCellTypeConst } from '@shared/constants/vehicle'

const baseLayout: SeatCellTypeConst[][] = [['SEAT', 'SEAT']]
const baseLayoutConfig = { rows: 1, cols: 2, aisleAfterCol: null, driverPos: [0, 1] as [number, number] }

function existingVehicleData(overrides: Partial<CreateVehicleDto> = {}): CreateVehicleDto {
  return {
    label: 'Innova',
    vehicleType: 'innova',
    layoutConfig: baseLayoutConfig,
    layout: baseLayout,
    photos: ['https://res.cloudinary.com/demo/existing-1.jpg'],
    ...overrides,
  }
}

describe('VehicleTab — seeds SeatLayoutBuilder with existing photos (edit-trip page)', () => {
  it('passes the existing vehicle photos through to the seat layout builder preview', async () => {
    const user = userEvent.setup()
    const onVehicleChange = vi.fn()

    renderWithQuery(
      <VehicleTab
        initialEnabled
        initialVehicleData={[existingVehicleData()]}
        onVehicleChange={onVehicleChange}
      />,
    )

    // Saved vehicle entries render collapsed by default — expand to reveal the builder/gallery
    await user.click(screen.getByRole('button', { name: /Innova/i }))

    const photo = await screen.findByAltText('Vehicle photo 1')
    expect(photo).toHaveAttribute('src', 'https://res.cloudinary.com/demo/existing-1.jpg')
  })

  it('does not render any photo when the existing vehicle has none', async () => {
    const user = userEvent.setup()
    const onVehicleChange = vi.fn()

    renderWithQuery(
      <VehicleTab
        initialEnabled
        initialVehicleData={[existingVehicleData({ photos: [] })]}
        onVehicleChange={onVehicleChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Innova/i }))

    expect(screen.queryByAltText('Vehicle photo 1')).not.toBeInTheDocument()
  })
})
