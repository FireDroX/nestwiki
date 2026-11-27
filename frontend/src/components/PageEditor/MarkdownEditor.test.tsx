import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkdownEditor } from './MarkdownEditor'

function Harness({ initial = '', onChange }: { initial?: string; onChange: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
        onSave={vi.fn()}
      />
      <button type="button">after</button>
    </>
  )
}

function editor() {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('MarkdownEditor indentation', () => {
  it('indents with Tab and keeps the focus in the textarea', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="abc" onChange={onChange} />)
    await user.click(editor())
    await user.keyboard('{End}{Tab}')
    expect(onChange).toHaveBeenLastCalledWith('abc  ')
    expect(editor()).toHaveFocus()
  })

  it('outdents with Shift+Tab', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="    abc" onChange={onChange} />)
    await user.click(editor())
    await user.keyboard('{End}{Shift>}{Tab}{/Shift}')
    expect(onChange).toHaveBeenLastCalledWith('  abc')
    expect(editor()).toHaveFocus()
  })

  it('lets the focus leave after Escape then Tab', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial="abc" onChange={onChange} />)
    await user.click(editor())
    await user.keyboard('{Escape}{Tab}')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })
})
