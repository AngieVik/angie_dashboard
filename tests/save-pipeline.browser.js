/* global performance */
// Run via playwright-cli run-code --filename=tests/save-pipeline.browser.js
// Uses a dedicated IndexedDB and an origin-private test folder; no user files.
async page => {
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(page.url())) throw new Error('Use an isolated local browser')
  const result = await page.evaluate(async () => {
    const { createDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createDatabase } = await import('/src/storage/db.ts')
    const { createWorkspaceFiles } = await import('/src/platform/files/workspaceFiles.ts')
    const { addNotebookBlock, editNotebookNote } = await import('/src/features/notebook/notebookCommands.ts')
    const check = (condition, message) => { if (!condition) throw new Error(message) }
    const db = createDatabase('angie-save-pipeline-test')
    const repository = new DocumentRepository(db)
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('save-pipeline-test', { create: true })
    // OPFS is isolated test storage and has no permission prompt API.
    const handle = Object.create(root)
    for (const key of ['getDirectoryHandle', 'getFileHandle', 'entries', 'removeEntry', 'isSameEntry']) handle[key] = root[key].bind(root)
    handle.queryPermission = async () => 'granted'
    const files = createWorkspaceFiles(async () => ({ handle, accessId: 'save-pipeline-test', isContainer: true }))
    const store = createDocumentStore(repository, { platform: { download() {} }, workspace: files })
    await store.initialize(); check(await store.newDocument('Prueba ' + Date.now()), 'create')
    store.applyDocumentCommand(d => addNotebookBlock(d, 'note'))
    await store.flushWorkspaceSave()
    const edit = text => store.applyDocumentCommand(d => editNotebookNote(d, d.notebook[0].id, text))
    const start = performance.now()
    for (let i = 0; i < 30; i++) edit('Ráfaga ' + i)
    const editMs = performance.now() - start
    await store.flushWorkspaceSave()
    check((await repository.loadActive()).notebook[0].text === 'Ráfaga 29', 'local burst')
    check(store.getSnapshot().workspaceStatus === 'saved' && !store.getSnapshot().fileDirty, 'folder burst')
    const firstId = store.getSnapshot().document.document.id
    edit('Final saliente')
    check(await store.newDocument('Siguiente ' + Date.now()), 'switch')
    await store.flushWorkspaceSave()
    const previous = await repository.loadRecoverable('board:' + firstId)
    check(previous.document.notebook[0].text === 'Final saliente', 'outgoing revision')
    check(store.getSnapshot().document.document.id !== firstId && store.getSnapshot().workspaceStatus === 'saved', 'generation')
    store.applyDocumentCommand(d => addNotebookBlock(d, 'note'))
    await store.flushWorkspaceSave()
    const save = repository.saveActive.bind(repository), folderSave = files.save.bind(files)
    repository.saveActive = async () => { throw new Error('QuotaExceededError de prueba') }
    files.save = async () => ({ status: 'error', message: 'Carpeta no disponible de prueba' })
    edit('Fallo conservado'); await store.flushWorkspaceSave()
    check(store.getSnapshot().autosaveUnavailable && store.getSnapshot().fileDirty && store.getSnapshot().workspaceStatus === 'error', 'failure status')
    check(!await store.newDocument('Bloqueado'), 'replacement must be blocked')
    repository.saveActive = save; files.save = folderSave
    await store.retryAutosave(); await store.saveWorkspaceNow()
    check(!store.getSnapshot().autosaveUnavailable && store.getSnapshot().workspaceStatus === 'saved', 'retry')
    // An external folder edit must retain its contents and its own channel error.
    const parts = store.getSnapshot().workspacePath.split('/')
    const folder = await (await root.getDirectoryHandle(parts[0])).getDirectoryHandle(parts[1])
    const file = await folder.getFileHandle('dashboard.json')
    const originalText = await (await file.getFile()).text()
    const externalFile = JSON.parse(originalText)
    externalFile.notebook[0].text = 'Edición externa de carpeta'
    const externalText = JSON.stringify(externalFile, null, 2) + '\n'
    const write = async text => { const writer = await file.createWritable(); await writer.write(text); await writer.close() }
    await write(externalText)
    edit('Revisión local tras cambio externo'); await store.flushWorkspaceSave()
    check(store.getSnapshot().workspaceStatus === 'error' && store.getSnapshot().fileDirty && !store.getSnapshot().autosaveUnavailable, 'folder conflict channel')
    check(await (await file.getFile()).text() === externalText, 'external file preserved')
    await write(originalText); await store.saveWorkspaceNow()
    check(store.getSnapshot().workspaceStatus === 'saved', 'test folder baseline restored')
    // Independent repository instances share real IndexedDB revision conflicts.
    const other = new DocumentRepository(createDatabase('angie-save-pipeline-test'))
    const external = await other.loadActive()
    await other.saveActive(editNotebookNote(external, external.notebook[0].id, 'Otra pestaña').document)
    edit('Conflicto en memoria'); await store.flushWorkspaceSave()
    check(store.getSnapshot().storageConflict, 'real revision conflict: ' + JSON.stringify({ conflict: store.getSnapshot().storageConflict, dirty: store.getSnapshot().fileDirty, workspace: store.getSnapshot().workspaceStatus }))
    check((await other.loadActive()).notebook[0].text === 'Otra pestaña', 'external data preserved')
    // Restore the known revision through a new store for the crash experiment.
    await other.rememberPresence({ documentId: external.document.id, seenAt: new Date().toISOString(), closed: false })
    const crashStore = createDocumentStore(other, { platform: { download() {} } })
    await crashStore.initialize()
    crashStore.applyDocumentCommand(d => editNotebookNote(d, d.notebook[0].id, 'Protegida antes del cierre'))
    await crashStore.flushAutosave()
    // Hold the next write indefinitely: a crash must recover the completed
    // revision, never label this later in-memory revision as saved.
    other.saveActive = async () => new Promise(() => {})
    crashStore.applyDocumentCommand(d => editNotebookNote(d, d.notebook[0].id, 'Pendiente al forzar cierre'))
    check(crashStore.getSnapshot().autosaveSaving && crashStore.getSnapshot().fileDirty, 'pending crash revision')
    return { editMs: Math.round(editMs * 100) / 100, burst: true, switched: true, storageFailure: true, conflict: true, folderConflict: true, pendingBeforeCrash: true }
  })
  // Close the renderer target without running pagehide/beforeunload handlers.
  const cdp = await page.context().newCDPSession(page)
  const { targetInfo } = await cdp.send('Target.getTargetInfo')
  await cdp.send('Target.closeTarget', { targetId: targetInfo.targetId })
  const recovered = await page.context().newPage()
  await recovered.goto(page.url())
  const recovery = await recovered.evaluate(async () => {
    const { createDocumentStore } = await import('/src/features/document/documentStore.ts')
    const { DocumentRepository } = await import('/src/storage/documentRepository.ts')
    const { createDatabase } = await import('/src/storage/db.ts')
    const store = createDocumentStore(new DocumentRepository(createDatabase('angie-save-pipeline-test')), { platform: { download() {} } })
    await store.initialize()
    const state = store.getSnapshot()
    if (!state.active || state.document.notebook[0].text !== 'Protegida antes del cierre') throw new Error('Forced-close recovery did not select the last completed revision')
    if (state.autosaveSaving || !state.localSavedAt) throw new Error('Recovered local result')
    return { active: state.active, text: state.document.notebook[0].text, pendingRevisionNotRecovered: true }
  })
  return { status: 'PASS', ...result, forcedClose: recovery }
}
