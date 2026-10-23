import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { PageTreeContext } from '#hooks/usePageTree'
import type { PageMetadataFormValues } from '#schemas/page-metadata.schema'
import { PageMetadataForm } from './PageMetadataForm'

interface HarnessProps {
  mode?: 'create' | 'edit'
  linkingPageCount?: number
  updateLinks?: boolean
  onUpdateLinksChange?: (updateLinks: boolean) => void
}

function Harness({ mode = 'create', ...linkProps }: HarnessProps) {
  const { control, setValue, watch } = useForm<PageMetadataFormValues>({
    defaultValues: { title: '', slug: '', visibility: 'public', parentId: null },
  })

  return (
    <PageTreeContext.Provider value={{ tree: [], status: 'success', refresh: async () => {} }}>
      <PageMetadataForm mode={mode} control={control} setValue={setValue} watch={watch} {...linkProps} />
    </PageTreeContext.Provider>
  )
}

describe('PageMetadataForm', () => {
  it('auto-generates the slug from the title while creating a page', async () => {
    const user = userEvent.setup()
    render(<Harness mode="create" />)

    await user.type(screen.getByLabelText('Titre'), 'Guide de Démarrage !')

    expect(screen.getByLabelText('Chemin')).toHaveValue('guide-de-demarrage')
  })

  it('stops auto-generating the slug once the user edits it directly', async () => {
    const user = userEvent.setup()
    render(<Harness mode="create" />)

    await user.type(screen.getByLabelText('Titre'), 'First title')
    await user.clear(screen.getByLabelText('Chemin'))
    await user.type(screen.getByLabelText('Chemin'), 'custom-slug')
    await user.type(screen.getByLabelText('Titre'), ' updated')

    expect(screen.getByLabelText('Chemin')).toHaveValue('custom-slug')
  })

  describe('links to the page when moving it', () => {
    it('offers to update the pages linking to the page or its subpages', async () => {
      const user = userEvent.setup()
      const onUpdateLinksChange = vi.fn()
      render(<Harness mode="edit" linkingPageCount={3} updateLinks onUpdateLinksChange={onUpdateLinksChange} />)

      expect(screen.getByText('3 pages contiennent des liens vers cette page ou ses sous-pages.')).toBeInTheDocument()
      const checkbox = screen.getByRole('checkbox', { name: 'Mettre à jour ces liens au déplacement' })
      expect(checkbox).toBeChecked()

      await user.click(checkbox)

      expect(onUpdateLinksChange).toHaveBeenCalledWith(false)
    })

    it('stays quiet when nothing links to the page', () => {
      render(<Harness mode="edit" linkingPageCount={0} updateLinks onUpdateLinksChange={vi.fn()} />)

      expect(screen.queryByText(/contiennent des liens|contient des liens/)).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: 'Mettre à jour ces liens au déplacement' })).not.toBeInTheDocument()
    })
  })
})
