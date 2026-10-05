import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResponsiveTable, type ResponsiveColumn } from './ResponsiveTable'

interface Fruit {
  id: string
  name: string
  color: string
}

const FRUITS: Fruit[] = [
  { id: 'a', name: 'Apple', color: 'Red' },
  { id: 'b', name: 'Banana', color: 'Yellow' },
]

const COLUMNS: ResponsiveColumn<Fruit>[] = [
  { id: 'name', header: 'Name', cell: (fruit) => fruit.name, primary: true },
  { id: 'color', header: 'Color', cell: (fruit) => fruit.color },
]

const originalMatchMedia = window.matchMedia

function setViewport(desktop: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ResponsiveTable', () => {
  it('renders a regular table with one header per column on wide screens', () => {
    setViewport(true)

    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={FRUITS}
        rowKey={(fruit) => fruit.id}
        actions={(fruit) => <button type="button">Delete {fruit.name}</button>}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Color' })).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByRole('button', { name: 'Delete Banana' })).toBeInTheDocument()
  })

  it('renders one card per row on narrow screens, labelling every secondary field', () => {
    setViewport(false)

    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={FRUITS}
        rowKey={(fruit) => fruit.id}
        actions={(fruit) => <button type="button">Delete {fruit.name}</button>}
      />,
    )

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    const banana = cards[1]
    expect(within(banana).getByText('Banana')).toBeInTheDocument()
    expect(within(banana).getByText('Color')).toBeInTheDocument()
    expect(within(banana).getByText('Yellow')).toBeInTheDocument()
    expect(within(banana).queryByText('Name')).not.toBeInTheDocument()
    expect(within(banana).getByRole('button', { name: 'Delete Banana' })).toBeInTheDocument()
  })

  it('lets rows be selected one by one or all at once, in both layouts', async () => {
    const user = userEvent.setup()

    for (const desktop of [true, false]) {
      setViewport(desktop)
      const onSelectedChange = vi.fn()
      const { unmount } = render(
        <ResponsiveTable
          columns={COLUMNS}
          rows={FRUITS}
          rowKey={(fruit) => fruit.id}
          selection={{
            selectedKeys: ['a'],
            onSelectedChange,
            selectAllLabel: 'Select all',
            selectRowLabel: (fruit) => `Select ${fruit.name}`,
          }}
        />,
      )

      expect(screen.getByRole('checkbox', { name: 'Select Apple' })).toBeChecked()
      await user.click(screen.getByRole('checkbox', { name: 'Select Banana' }))
      expect(onSelectedChange).toHaveBeenLastCalledWith(['a', 'b'])
      await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
      expect(onSelectedChange).toHaveBeenLastCalledWith(['a', 'b'])
      unmount()
    }
  })

  it('opens a row when it is clicked, as a table row or as a card', async () => {
    const user = userEvent.setup()

    for (const desktop of [true, false]) {
      setViewport(desktop)
      const onRowClick = vi.fn()
      const { unmount } = render(
        <ResponsiveTable columns={COLUMNS} rows={FRUITS} rowKey={(fruit) => fruit.id} onRowClick={onRowClick} />,
      )

      await user.click(screen.getByText('Yellow'))
      expect(onRowClick).toHaveBeenCalledWith(FRUITS[1])
      unmount()
    }
  })

  it('can label the actions column and leave out the select-all checkbox', () => {
    setViewport(true)

    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={FRUITS}
        rowKey={(fruit) => fruit.id}
        actionsHeader="Actions"
        actions={() => <button type="button">Open</button>}
        selection={{ selectedKeys: [], onSelectedChange: vi.fn(), selectRowLabel: (fruit) => `Pick ${fruit.name}` }}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('shows the empty state instead of an empty table', () => {
    setViewport(true)

    render(
      <ResponsiveTable columns={COLUMNS} rows={[]} rowKey={(fruit) => fruit.id} empty={<p>No fruit</p>} />,
    )

    expect(screen.getByText('No fruit')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
