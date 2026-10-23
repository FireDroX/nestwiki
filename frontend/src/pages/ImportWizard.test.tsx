import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { ImportPlan, ImportReport } from '#api/imports'
import type { PageTreeNode } from '#api/pages'
import { PageTreeContext } from '#hooks/usePageTree'
import { ImportWizard } from './ImportWizard'

const previewImportMock = vi.fn()
const runImportMock = vi.fn()
vi.mock('#api/imports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#api/imports')>()),
  previewImport: (...args: unknown[]) => previewImportMock(...args),
  runImport: (...args: unknown[]) => runImportMock(...args),
}))

const hasGlobalMock = vi.fn()
vi.mock('#hooks/usePermissions', () => ({
  usePermissions: () => ({ hasGlobal: hasGlobalMock, canOnPage: () => true }),
}))

Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

const tree: PageTreeNode[] = [
  {
    id: 'docs',
    slug: 'docs',
    title: 'Docs',
    visibility: 'public',
    canCreateChild: true,
    children: [{ id: 'locked', slug: 'locked', title: 'Verrouillée', visibility: 'private', canCreateChild: false, children: [] }],
  },
]

const emptyWarnings = {
  unresolvedLinks: [],
  ignoredFiles: [],
  missingTags: [],
  mediaWithoutUpload: 0,
  renamedSlugs: [],
}

function buildPlan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    format: 'obsidian',
    destination: { id: 'docs', path: '/docs' },
    conflictMode: 'skip',
    pageCount: 2,
    conflictCount: 1,
    pages: [
      {
        path: '/docs/guide',
        title: 'Guide',
        slug: 'guide',
        tags: ['projet'],
        linkCount: 2,
        mediaCount: 1,
        action: 'skip',
        conflict: { id: 'guide-id', path: '/docs/guide' },
        children: [
          {
            path: '/docs/guide/install',
            title: 'Installation',
            slug: 'install',
            tags: [],
            linkCount: 0,
            mediaCount: 0,
            action: 'create',
            conflict: null,
            children: [],
          },
        ],
      },
    ],
    media: { count: 1, totalSize: 2048 },
    tags: { existing: ['projet'], missing: ['nouveau'] },
    permissions: { canCreateTags: true, canUploadMedia: true },
    warnings: {
      unresolvedLinks: [{ page: '/docs/guide', target: 'Absente' }],
      ignoredFiles: [{ file: 'dessin.svg', reason: 'unsupported_type' }],
      missingTags: [],
      mediaWithoutUpload: 0,
      renamedSlugs: [{ page: '/docs/trash-2', from: 'trash', to: 'trash-2', reason: 'reserved' }],
    },
    ...overrides,
  }
}

const report: ImportReport = {
  rootPath: '/docs/guide',
  created: [{ id: 'install-id', path: '/docs/guide/install', title: 'Installation' }],
  updated: [],
  skipped: [{ id: 'guide-id', path: '/docs/guide', title: 'Guide', reason: 'exists' }],
  media: { uploaded: 1 },
  tags: { created: ['nouveau'], skipped: [] },
  warnings: { ...emptyWarnings, unresolvedLinks: [{ page: '/docs/guide', target: 'Absente' }] },
}

function renderWizard(path = '/import') {
  return render(
    <PageTreeContext.Provider value={{ tree, status: 'success', refresh: async () => {} }}>
      <MemoryRouter initialEntries={[path]}>
        <ImportWizard />
      </MemoryRouter>
    </PageTreeContext.Provider>,
  )
}

const vault = () => new File(['zip'], 'coffre.zip', { type: 'application/zip' })

async function reachPreview(user: ReturnType<typeof userEvent.setup>, path = '/import?parent=docs') {
  previewImportMock.mockResolvedValue(buildPlan())
  renderWizard(path)
  await user.upload(screen.getByTestId('import-file-input'), vault())
  await user.click(screen.getByRole('button', { name: 'Analyser' }))
  await screen.findByText('Pages')
}

describe('ImportWizard', () => {
  beforeEach(() => {
    previewImportMock.mockReset()
    runImportMock.mockReset()
    hasGlobalMock.mockReset().mockReturnValue(true)
  })

  it('starts on the file step with the accepted formats and limits', () => {
    renderWizard()

    expect(screen.getByText('Glissez une archive .zip ou un fichier .md ici')).toBeInTheDocument()
    expect(screen.getByText(/Coffre Obsidian zippé/)).toBeInTheDocument()
    expect(screen.getByText(/Jusqu’à 100 Mo, 500 Mo une fois décompressé et 1\s000 pages\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Racine du wiki' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeDisabled()
  })

  it('refuses files that are neither .zip nor .md', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderWizard()

    await user.upload(screen.getByTestId('import-file-input'), new File(['x'], 'notes.pdf'))

    expect(screen.getByText('Choisissez un fichier .zip ou .md.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeDisabled()
  })

  it('accepts a dropped file', async () => {
    renderWizard()
    const dropzone = screen.getByTestId('import-dropzone')

    fireEvent.drop(dropzone, { dataTransfer: { files: [vault()] } })

    expect(await screen.findByText('coffre.zip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeEnabled()
  })

  it('preselects the destination from ?parent= and only offers pages where children can be created', async () => {
    const user = userEvent.setup()
    hasGlobalMock.mockReturnValue(false)
    renderWizard('/import?parent=docs')

    await user.click(screen.getByRole('button', { name: 'Docs' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Docs')).toBeInTheDocument()
    expect(within(dialog).queryByText('Docs / Verrouillée')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Racine du wiki')).not.toBeInTheDocument()
  })

  it('requires a destination without the right to create root pages', async () => {
    const user = userEvent.setup()
    hasGlobalMock.mockReturnValue(false)
    renderWizard()

    await user.upload(screen.getByTestId('import-file-input'), vault())

    expect(screen.getByRole('button', { name: 'Choisir la destination' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeDisabled()
  })

  it('shows the server error on the file step', async () => {
    const user = userEvent.setup()
    previewImportMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: 'The archive is invalid or corrupted' } },
    })
    renderWizard()

    await user.upload(screen.getByTestId('import-file-input'), vault())
    await user.click(screen.getByRole('button', { name: 'Analyser' }))

    expect(await screen.findByText('The archive is invalid or corrupted')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyser' })).toBeEnabled()
  })

  it('previews the pages with their conflicts and grouped warnings', async () => {
    const user = userEvent.setup()
    await reachPreview(user)

    expect(previewImportMock).toHaveBeenCalledWith(expect.any(File), 'docs', 'skip')
    expect(screen.getByText(/Coffre Obsidian · 2 pages · 1 média/)).toBeInTheDocument()
    expect(screen.getByText('1 page existe déjà au même endroit.')).toBeInTheDocument()
    const [guide, install] = screen.getAllByTestId('import-plan-page')
    expect(within(guide).getByText('Existe déjà')).toBeInTheDocument()
    expect(within(guide).getByText('Ignorée')).toBeInTheDocument()
    expect(within(install).getByText('/docs/guide/install')).toBeInTheDocument()
    expect(within(install).queryByText('Existe déjà')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Liens non résolus (1)' }))
    expect(screen.getByText('/docs/guide → Absente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fichiers ignorés (1)' }))
    expect(screen.getByText('dessin.svg — type non pris en charge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adresses renommées (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tags non créés (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer 1 page' })).toBeEnabled()
  })

  it('recomputes the preview when the conflict mode changes', async () => {
    const user = userEvent.setup()
    await reachPreview(user)
    previewImportMock.mockResolvedValue(buildPlan({ conflictMode: 'rename', conflictCount: 0 }))

    await user.click(screen.getByRole('combobox', { name: 'Pages déjà présentes' }))
    await user.click(await screen.findByRole('option', { name: 'Importer sous un autre nom (-2)' }))

    expect(previewImportMock).toHaveBeenLastCalledWith(expect.any(File), 'docs', 'rename')
    expect(await screen.findByRole('combobox', { name: 'Pages déjà présentes' })).toHaveTextContent(
      'Importer sous un autre nom (-2)',
    )
  })

  it('hides the missing tags option without tag.create', async () => {
    const user = userEvent.setup()
    previewImportMock.mockResolvedValue(
      buildPlan({
        permissions: { canCreateTags: false, canUploadMedia: false },
        warnings: { ...emptyWarnings, mediaWithoutUpload: 1, missingTags: ['nouveau'] },
      }),
    )
    renderWizard('/import?parent=docs')
    await user.upload(screen.getByTestId('import-file-input'), vault())
    await user.click(screen.getByRole('button', { name: 'Analyser' }))
    await screen.findByText('Pages')

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.getByText('1 média ne sera pas importé : il faut le droit de téléverser des médias.'),
    ).toBeInTheDocument()
  })

  it('imports with the chosen options, shows the progress, then the report', async () => {
    const user = userEvent.setup()
    await reachPreview(user)
    let finish: (value: ImportReport) => void = () => {}
    runImportMock.mockImplementation(
      (_file: File, _options: unknown, onProgress: (percent: number) => void) =>
        new Promise<ImportReport>((resolve) => {
          onProgress(40)
          finish = resolve
        }),
    )

    await user.click(screen.getByRole('button', { name: 'Publiques' }))
    await user.click(screen.getByRole('checkbox', { name: 'Créer le tag manquant : nouveau' }))
    expect(screen.queryByRole('button', { name: 'Tags non créés (1)' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Importer 1 page' }))

    expect(await screen.findByText('Envoi du fichier… 40 %')).toBeInTheDocument()
    expect(runImportMock).toHaveBeenCalledWith(
      expect.any(File),
      { parentId: 'docs', conflict: 'skip', visibility: 'public', createMissingTags: true },
      expect.any(Function),
    )

    finish(report)

    expect(await screen.findByText('Import terminé')).toBeInTheDocument()
    expect(screen.getByTestId('import-report-created')).toHaveTextContent('1')
    expect(screen.getByTestId('import-report-skipped')).toHaveTextContent('1')
    expect(screen.getByTestId('import-report-media')).toHaveTextContent('1')
    expect(screen.getByTestId('import-report-tags')).toHaveTextContent('1')
    expect(screen.getByText('/docs/guide — existe déjà')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Liens non résolus (1)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir' })).toHaveAttribute('href', '/pages/docs/guide')
  })

  it('goes back to the preview with the server error when the import fails', async () => {
    const user = userEvent.setup()
    await reachPreview(user)
    runImportMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error: 'Insufficient permissions on this page' } },
    })

    await user.click(screen.getByRole('button', { name: 'Importer 1 page' }))

    expect(await screen.findByText('Insufficient permissions on this page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importer 1 page' })).toBeEnabled()
  })

  it('starts over from the report', async () => {
    const user = userEvent.setup()
    await reachPreview(user)
    runImportMock.mockResolvedValue(report)
    await user.click(screen.getByRole('button', { name: 'Importer 1 page' }))
    await screen.findByText('Import terminé')

    await user.click(screen.getByRole('button', { name: 'Nouvel import' }))

    expect(screen.getByText('Glissez une archive .zip ou un fichier .md ici')).toBeInTheDocument()
  })
})
