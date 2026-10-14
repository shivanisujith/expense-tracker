import { useEffect, useRef, useState } from 'react'
import { addCategory, deleteCategory, renameCategory } from '../api.js'
import { checkCategoryName } from '../categoryNames.js'
import { BinIcon, IconButton, PencilIcon } from './icons.jsx'
import SuccessMessage from './SuccessMessage.jsx'

const UNREACHABLE_MESSAGE = "Can't reach the server. Check that the backend is running, then try again."

/**
 * The Manage categories popup (specs/frontend-spec.md, section 5). Uses the
 * same <dialog> pattern as EditExpenseModal. `categories` is the current
 * list of { id, name } from the summary; `onChanged` reloads the page data.
 * `success` is the category success message, shown at the top of the list.
 */
function ManageCategoriesModal({ categories, success, onSuccess, onChanged, onClose, onUnreachable }) {
  const dialogRef = useRef(null)
  const addInputRef = useRef(null)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameText, setRenameText] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [rowError, setRowError] = useState(null) // { id, message }
  const [topMessage, setTopMessage] = useState('')
  // What is being saved: 'add', or 'rename' / 'delete' plus an id.
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    // Start in the add box rather than on the first rename icon.
    addInputRef.current.focus()
  }, [])

  // Escape: close like Close, except while saving.
  function handleCancelEvent(event) {
    event.preventDefault()
    if (!busy) onClose()
  }

  /** Runs one change. Returns true if it worked. */
  async function save(what, action, showError, successMessage) {
    setTopMessage('')
    setBusy(what)
    try {
      await action()
      onSuccess(successMessage)
      await onChanged()
      return true
    } catch (error) {
      if (error.kind === 'unreachable') {
        setTopMessage(UNREACHABLE_MESSAGE)
        onUnreachable()
      } else if (error.kind === 'not_found') {
        setTopMessage(error.message)
        onChanged()
      } else {
        showError(error.message)
      }
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleAdd(event) {
    event.preventDefault()
    const checked = checkCategoryName(newName, categories)
    if (checked.error) {
      setAddError(checked.error)
      return
    }
    setAddError('')
    if (await save('add', () => addCategory(checked.name), setAddError, 'Category added')) {
      setNewName('')
    }
  }

  function startRename(category) {
    setConfirmingId(null)
    setRowError(null)
    setRenamingId(category.id)
    setRenameText(category.name)
  }

  async function handleRename(event, id) {
    event.preventDefault()
    const checked = checkCategoryName(renameText, categories, id)
    if (checked.error) {
      setRowError({ id, message: checked.error })
      return
    }
    setRowError(null)
    const showError = (message) => setRowError({ id, message })
    const rename = () => renameCategory(id, checked.name)
    if (await save(`rename-${id}`, rename, showError, 'Category renamed')) {
      setRenamingId(null)
    }
  }

  function askDelete(id) {
    setRenamingId(null)
    setRowError(null)
    setConfirmingId(id)
  }

  async function handleDelete(id) {
    const showError = (message) => {
      setConfirmingId(null)
      setRowError({ id, message })
    }
    if (await save(`delete-${id}`, () => deleteCategory(id), showError, 'Category deleted')) {
      setConfirmingId(null)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal manage-modal"
      aria-labelledby="manage-title"
      onCancel={handleCancelEvent}
      onClose={onClose}
    >
      <h2 id="manage-title">Manage categories</h2>
      {topMessage && (
        <p className="form-error modal-message" role="alert">
          {topMessage}
        </p>
      )}

      <SuccessMessage success={success} className="top-of-list" />
      <ul className="manage-list">
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            renaming={renamingId === category.id}
            renameText={renameText}
            confirming={confirmingId === category.id}
            error={rowError?.id === category.id ? rowError.message : ''}
            busy={busy}
            onRenameTextChange={setRenameText}
            onStartRename={() => startRename(category)}
            onSaveRename={(event) => handleRename(event, category.id)}
            onCancelRename={() => {
              setRenamingId(null)
              setRowError(null)
            }}
            onAskDelete={() => askDelete(category.id)}
            onConfirmDelete={() => handleDelete(category.id)}
            onCancelDelete={() => setConfirmingId(null)}
          />
        ))}
      </ul>

      <form className="add-category" onSubmit={handleAdd} noValidate>
        <label htmlFor="new-category">Add a category</label>
        <div className="inline-controls">
          <input
            id="new-category"
            ref={addInputRef}
            className="text-input"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            aria-invalid={Boolean(addError)}
            aria-describedby={addError ? 'new-category-error' : undefined}
          />
          <button type="submit" disabled={busy !== null}>
            {busy === 'add' ? 'Saving...' : 'Add'}
          </button>
        </div>
        {addError && (
          <p className="field-error" id="new-category-error">
            {addError}
          </p>
        )}
      </form>

      <div className="modal-buttons">
        <button type="button" className="secondary" onClick={onClose} disabled={busy !== null}>
          Close
        </button>
      </div>
    </dialog>
  )
}

function CategoryRow({
  category,
  renaming,
  renameText,
  confirming,
  error,
  busy,
  onRenameTextChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const errorId = `category-${category.id}-error`

  return (
    <li className="manage-row">
      {renaming ? (
        <form className="inline-controls" onSubmit={onSaveRename} noValidate>
          <input
            className="text-input"
            aria-label={`New name for ${category.name}`}
            value={renameText}
            onChange={(event) => onRenameTextChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            autoFocus
          />
          <button type="submit" disabled={busy !== null}>
            {busy === `rename-${category.id}` ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="secondary" onClick={onCancelRename} disabled={busy !== null}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="manage-row-main">
          <span className="manage-name">{category.name}</span>
          <div className="item-buttons">
            <IconButton
              label={`Rename ${category.name}`}
              onClick={onStartRename}
              disabled={confirming || busy !== null}
            >
              <PencilIcon />
            </IconButton>
            <IconButton
              label={`Delete ${category.name}`}
              onClick={onAskDelete}
              disabled={confirming || busy !== null}
            >
              <BinIcon />
            </IconButton>
          </div>
        </div>
      )}

      {confirming && (
        <div className="confirm-delete" role="alert">
          <p>Delete {category.name}? This can't be undone.</p>
          <div className="confirm-buttons">
            <button
              type="button"
              className="danger-solid"
              onClick={onConfirmDelete}
              disabled={busy !== null}
            >
              {busy === `delete-${category.id}` ? 'Deleting...' : 'Delete'}
            </button>
            <button type="button" className="secondary" onClick={onCancelDelete} disabled={busy !== null}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

export default ManageCategoriesModal
