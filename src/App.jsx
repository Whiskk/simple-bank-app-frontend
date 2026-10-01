import { Fragment, useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import './App.css'

const EMPTY_CREDENTIALS = { name: '', username: '', password: '' }
const EMPTY_PROFILE = { name: '', username: '', currentPassword: '', newPassword: '', confirmPassword: '' }

async function readResponse(response, statusMessages = {}) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      statusMessages[response.status] ||
        data?.detail ||
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`,
    )
  }

  return data
}

function App() {
  const [page, setPage] = useState(() =>
    window.location.pathname === '/customers'
      ? 'customers'
      : window.location.pathname === '/accounts'
        ? 'accounts'
        : 'home',
  )
  const [token, setToken] = useState(() => sessionStorage.getItem('bankapp-token') || '')
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem('bankapp-admin') === 'true')
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileStatus, setProfileStatus] = useState({ type: 'idle', message: '' })
  const profileDialogRef = useRef(null)
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [accountsByCustomer, setAccountsByCustomer] = useState({})
  const [accountDialogTarget, setAccountDialogTarget] = useState(null)
  const [newAccountType, setNewAccountType] = useState('SAVINGS')
  const [accountCreateStatus, setAccountCreateStatus] = useState({ type: 'idle', message: '' })
  const accountDialogRef = useRef(null)
  const [transferSource, setTransferSource] = useState(null)
  const [transferDestinationId, setTransferDestinationId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferStatus, setTransferStatus] = useState({ type: 'idle', message: '' })
  const transferDialogRef = useRef(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState({ type: 'idle', message: '' })
  const deleteDialogRef = useRef(null)
  const [credentials, setCredentials] = useState(EMPTY_CREDENTIALS)
  const [loginMode, setLoginMode] = useState(() =>
    window.location.pathname === '/customers' ? 'admin' : 'customer',
  )
  const [isRegistering, setIsRegistering] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname
      setPage(path === '/customers' ? 'customers' : path === '/accounts' ? 'accounts' : 'home')
      setCredentials(EMPTY_CREDENTIALS)
      setIsRegistering(false)
      setStatus({ type: 'idle', message: '' })
      if (!token) {
        setLoginMode(path === '/customers' ? 'admin' : 'customer')
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [token])

  useEffect(() => {
    if (page !== 'customers' || !token) return
    if (!isAdmin) {
      window.history.replaceState({}, '', '/accounts')
      setPage('accounts')
      return
    }

    const controller = new AbortController()

    async function loadCustomers() {
      setStatus({ type: 'loading', message: 'Loading customers...' })

      try {
        const response = await fetch('/api/customers', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const data = await readResponse(response)

        if (!Array.isArray(data)) {
          throw new Error('The customers response was not a list.')
        }

        setCustomers(data)
        setStatus({ type: 'success', message: '' })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus({ type: 'error', message: error.message })
        }
      }
    }

    loadCustomers()
    return () => controller.abort()
  }, [page, token, isAdmin])

  useEffect(() => {
    if (page !== 'accounts' || !token) return

    const controller = new AbortController()

    async function loadMyAccounts() {
      setStatus({ type: 'loading', message: 'Loading your accounts...' })

      try {
        const response = await fetch('/api/accounts/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const data = await readResponse(response)

        if (!Array.isArray(data)) {
          throw new Error('The accounts response was not a list.')
        }

        setAccounts(data)
        setStatus({ type: 'success', message: '' })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setStatus({ type: 'error', message: error.message })
        }
      }
    }

    loadMyAccounts()
    return () => controller.abort()
  }, [page, token])

  useEffect(() => {
    if (page !== 'accounts' || !token || isAdmin) return

    const controller = new AbortController()

    async function loadProfile() {
      setProfileStatus({ type: 'loading', message: 'Loading profile...' })

      try {
        const response = await fetch('/api/customers/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        const data = await readResponse(response)
        setProfile(data)
        setProfileDraft({ ...EMPTY_PROFILE, name: data.name, username: data.username })
        setProfileStatus({ type: 'idle', message: '' })
      } catch (error) {
        if (error.name !== 'AbortError') {
          setProfileStatus({ type: 'error', message: error.message })
        }
      }
    }

    loadProfile()
    return () => controller.abort()
  }, [page, token, isAdmin])

  useEffect(() => {
    if (!editingProfile) return

    const dialog = profileDialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [editingProfile])

  useEffect(() => {
    if (!accountDialogTarget) return

    const dialog = accountDialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [accountDialogTarget])

  useEffect(() => {
    if (!transferSource) return

    const dialog = transferDialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [transferSource])

  useEffect(() => {
    if (!deleteTarget) return

    const dialog = deleteDialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [deleteTarget])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPage(path === '/customers' ? 'customers' : path === '/accounts' ? 'accounts' : 'home')
    setCredentials(EMPTY_CREDENTIALS)
    setStatus({ type: 'idle', message: '' })
    if (path === '/') {
      setLoginMode('customer')
      setIsRegistering(false)
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setStatus({ type: 'loading', message: isRegistering ? 'Creating account...' : 'Signing in...' })

    const headers = { 'Content-Type': 'application/json' }
    const loginDetails = {
      username: credentials.username,
      password: credentials.password,
    }

    try {
      if (isRegistering) {
        const registerResponse = await fetch('/api/auth/register', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...loginDetails, name: credentials.name }),
        })
        await readResponse(registerResponse)
      }

      const loginPath = loginMode === 'admin' ? '/api/auth/admin/login' : '/api/auth/login'
      const loginResponse = await fetch(loginPath, {
        method: 'POST',
        headers,
        body: JSON.stringify(loginDetails),
      })
      const loginData = await readResponse(loginResponse, {
        401: 'Username or password is incorrect.',
        403: loginMode === 'admin'
          ? 'This user is not an admin.'
          : 'Username or password is incorrect.',
      })

      if (!loginData?.token) {
        throw new Error('The login response did not include an access token.')
      }

      sessionStorage.setItem('bankapp-token', loginData.token)
      sessionStorage.setItem('bankapp-admin', String(Boolean(loginData.admin)))
      setToken(loginData.token)
      setIsAdmin(Boolean(loginData.admin))
      setStatus({ type: 'idle', message: '' })
      navigate(loginMode === 'admin' ? '/customers' : '/accounts')
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  function signOut() {
    sessionStorage.removeItem('bankapp-token')
    sessionStorage.removeItem('bankapp-admin')
    setToken('')
    setIsAdmin(false)
    setCustomers([])
    setAccounts([])
    setProfile(null)
    setProfileDraft(EMPTY_PROFILE)
    setEditingProfile(false)
    setProfileStatus({ type: 'idle', message: '' })
    setExpandedCustomerId(null)
    setAccountsByCustomer({})
    setAccountDialogTarget(null)
    setAccountCreateStatus({ type: 'idle', message: '' })
    setTransferSource(null)
    setTransferStatus({ type: 'idle', message: '' })
    setDeleteTarget(null)
    setDeleteStatus({ type: 'idle', message: '' })
    setStatus({ type: 'idle', message: '' })
    navigate('/')
  }

  function closeProfileEditor() {
    setEditingProfile(false)
    setProfileDraft({ ...EMPTY_PROFILE, name: profile.name, username: profile.username })
    setProfileStatus({ type: 'idle', message: '' })
  }

  async function handleProfileSubmit(event) {
    event.preventDefault()
    const username = profileDraft.username.trim()
    const changingUsername = username !== profile.username
    const changingPassword = profileDraft.newPassword !== ''

    if (changingPassword && profileDraft.newPassword !== profileDraft.confirmPassword) {
      setProfileStatus({ type: 'error', message: 'New passwords do not match.' })
      return
    }

    if ((changingUsername || changingPassword) && !profileDraft.currentPassword) {
      setProfileStatus({ type: 'error', message: 'Enter your current password to change your username or password.' })
      return
    }

    setProfileStatus({ type: 'loading', message: 'Saving profile...' })

    try {
      const response = await fetch('/api/customers/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileDraft.name.trim(),
          username,
          ...(changingUsername || changingPassword ? { currentPassword: profileDraft.currentPassword } : {}),
          ...(changingPassword ? { newPassword: profileDraft.newPassword } : {}),
        }),
      })
      const updated = await readResponse(response, {
        403: 'Current password is incorrect.',
        409: 'Username is already in use.',
      })

      if (changingPassword) {
        signOut()
        setStatus({ type: 'success', message: 'Password updated. Please sign in again.' })
        return
      }

      setProfile(updated)
      setProfileDraft({ ...EMPTY_PROFILE, name: updated.name, username: updated.username })
      setEditingProfile(false)
      setProfileStatus({ type: 'success', message: 'Profile updated.' })
    } catch (error) {
      setProfileStatus({ type: 'error', message: error.message })
    }
  }

  function openAccountDialog(customer) {
    setNewAccountType('SAVINGS')
    setAccountCreateStatus({ type: 'idle', message: '' })
    setAccountDialogTarget(customer)
  }

  function closeAccountDialog() {
    setAccountDialogTarget(null)
    setAccountCreateStatus({ type: 'idle', message: '' })
  }

  async function handleCreateAccount(event) {
    event.preventDefault()
    setAccountCreateStatus({ type: 'loading', message: 'Creating account...' })

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: accountDialogTarget.id, accountType: newAccountType }),
      })
      const created = await readResponse(response)

      if (isAdmin) {
        const customerId = accountDialogTarget.id
        setAccountsByCustomer((current) => ({
          ...current,
          [customerId]: {
            status: 'success',
            accounts: [...(current[customerId]?.accounts || []), created],
            error: '',
          },
        }))
        setExpandedCustomerId(customerId)
      } else {
        setAccounts((current) => [...current, created])
        setStatus({ type: 'success', message: '' })
      }

      closeAccountDialog()
    } catch (error) {
      setAccountCreateStatus({ type: 'error', message: error.message })
    }
  }

  function openTransferDialog(account) {
    setTransferSource(account)
    setTransferDestinationId(accounts.find((other) => other.id !== account.id)?.id || '')
    setTransferAmount('')
    setTransferStatus({ type: 'idle', message: '' })
  }

  function closeTransferDialog() {
    setTransferSource(null)
    setTransferAmount('')
    setTransferStatus({ type: 'idle', message: '' })
  }

  async function handleTransfer(event) {
    event.preventDefault()
    const amount = Number(transferAmount)

    if (!transferDestinationId || transferDestinationId === transferSource.id
        || !Number.isFinite(amount) || amount < 0.01 || amount > Number(transferSource.balance)) {
      setTransferStatus({ type: 'error', message: 'Choose another account and enter an amount within the available balance.' })
      return
    }

    setTransferStatus({ type: 'loading', message: 'Transferring...' })

    try {
      const response = await fetch('/api/accounts/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAccountId: transferSource.id,
          toAccountId: transferDestinationId,
          amount,
        }),
      })
      await readResponse(response)
    } catch (error) {
      setTransferStatus({ type: 'error', message: error.message })
      return
    }

    closeTransferDialog()
    setStatus({ type: 'loading', message: 'Refreshing balances...' })

    try {
      const response = await fetch('/api/accounts/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const updatedAccounts = await readResponse(response)
      if (!Array.isArray(updatedAccounts)) throw new Error('The accounts response was not a list.')
      setAccounts(updatedAccounts)
      setStatus({ type: 'success', message: 'Transfer complete.' })
    } catch {
      setAccounts([])
      setStatus({ type: 'error', message: 'Transfer completed, but balances could not be refreshed. Reload the page to see them.' })
    }
  }

  function closeDeleteDialog() {
    setDeleteTarget(null)
    setDeleteStatus({ type: 'idle', message: '' })
  }

  async function handleDeleteAccount() {
    setDeleteStatus({ type: 'loading', message: 'Deleting account...' })

    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(deleteTarget.account.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      await readResponse(response, { 409: 'Account balance must be zero before deletion.' })

      if (deleteTarget.customerId) {
        setAccountsByCustomer((current) => ({
          ...current,
          [deleteTarget.customerId]: {
            ...current[deleteTarget.customerId],
            accounts: current[deleteTarget.customerId].accounts.filter(
              (account) => account.id !== deleteTarget.account.id,
            ),
          },
        }))
      } else {
        setAccounts((current) => current.filter((account) => account.id !== deleteTarget.account.id))
      }

      closeDeleteDialog()
    } catch (error) {
      setDeleteStatus({ type: 'error', message: error.message })
    }
  }

  async function toggleCustomerAccounts(customerId) {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null)
      return
    }

    setExpandedCustomerId(customerId)

    const existingAccounts = accountsByCustomer[customerId]
    if (existingAccounts?.status === 'success' || existingAccounts?.status === 'loading') {
      return
    }

    setAccountsByCustomer((current) => ({
      ...current,
      [customerId]: { status: 'loading', accounts: [], error: '' },
    }))

    try {
      const response = await fetch(`/api/accounts?userId=${encodeURIComponent(customerId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const accounts = await readResponse(response)

      if (!Array.isArray(accounts)) {
        throw new Error('The accounts response was not a list.')
      }

      setAccountsByCustomer((current) => ({
        ...current,
        [customerId]: { status: 'success', accounts, error: '' },
      }))
    } catch (error) {
      setAccountsByCustomer((current) => ({
        ...current,
        [customerId]: { status: 'error', accounts: [], error: error.message },
      }))
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <button className="brand-button" type="button" onClick={() => navigate('/')}>
          Simple Bank
        </button>
        {token && (
          <div className="header-actions">
            {page === 'accounts' && !isAdmin && (
              <button
                className="text-button"
                type="button"
                disabled={!profile}
                onClick={() => {
                  setProfileDraft({ ...EMPTY_PROFILE, name: profile.name, username: profile.username })
                  setProfileStatus({ type: 'idle', message: '' })
                  setEditingProfile(true)
                }}
              >
                Edit profile
              </button>
            )}
            <button className="text-button" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>

      {page === 'home' || !token ? (
        <section className="page-content login-page">
          <div className="auth-section">
            <h1>{loginMode === 'admin' ? 'Admin login' : 'Customer login'}</h1>
            {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
            {status.type === 'success' && <p role="status">{status.message}</p>}
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {isRegistering && loginMode === 'customer' && (
                <label>
                  Name
                  <input
                    autoComplete="name"
                    required
                    value={credentials.name}
                    onChange={(event) => setCredentials({ ...credentials, name: event.target.value })}
                  />
                </label>
              )}
              <label>
                Username
                <input
                  autoComplete="username"
                  required
                  value={credentials.username}
                  onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  required
                  type="password"
                  value={credentials.password}
                  onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                />
              </label>
              <button className="primary-button" type="submit" disabled={status.type === 'loading'}>
                {status.type === 'loading'
                  ? status.message
                  : isRegistering
                    ? 'Create account'
                    : loginMode === 'admin'
                      ? 'Admin sign in'
                      : 'Sign in'}
              </button>
            </form>
            {loginMode === 'customer' && (
              <button
                className="text-button auth-toggle"
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering)
                  setCredentials(EMPTY_CREDENTIALS)
                  setStatus({ type: 'idle', message: '' })
                }}
              >
                {isRegistering ? 'Use an existing account' : 'Create a test account'}
              </button>
            )}
            <button
              className="text-button auth-toggle login-mode-toggle"
              type="button"
              onClick={() => {
                setLoginMode(loginMode === 'admin' ? 'customer' : 'admin')
                setIsRegistering(false)
                setCredentials(EMPTY_CREDENTIALS)
                setStatus({ type: 'idle', message: '' })
              }}
            >
              {loginMode === 'admin' ? 'Customer login' : 'Admin login'}
            </button>
          </div>
        </section>
      ) : page === 'accounts' || !isAdmin ? (
        <section className="page-content customers-page">
          <div className="page-title-row account-page-title">
            <h1>My accounts</h1>
            <button
              className="primary-button"
              type="button"
              disabled={!profile || status.type === 'loading'}
              onClick={() => openAccountDialog(profile)}
            >
              Add account
            </button>
          </div>
          {profileStatus.type === 'loading' && <p role="status">{profileStatus.message}</p>}
          {profileStatus.type === 'error' && !editingProfile && (
            <p className="error-message" role="alert">{profileStatus.message}</p>
          )}
          {profileStatus.type === 'success' && <p role="status">{profileStatus.message}</p>}
          {status.type === 'loading' && <p role="status">{status.message}</p>}
          {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
          {status.type === 'success' && accounts.length === 0 && <p>No accounts found.</p>}
          {accounts.length > 0 && (
            <div className="table-scroll">
              <table className="customer-accounts-table">
                <thead>
                  <tr>
                    <th scope="col">Account type</th>
                    <th scope="col">Current balance</th>
                    <th scope="col">Transfer</th>
                    <th scope="col"><span className="sr-only">Delete</span></th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.accountType}</td>
                      <td>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                        }).format(Number(account.balance))}
                      </td>
                      <td>
                        <button
                          className="account-toggle"
                          type="button"
                          disabled={accounts.length < 2 || Number(account.balance) <= 0}
                          title={accounts.length < 2
                            ? 'Add another account to transfer'
                            : Number(account.balance) <= 0 ? 'No funds available to transfer' : undefined}
                          onClick={() => openTransferDialog(account)}
                        >
                          Transfer
                        </button>
                      </td>
                      <td>
                        <button
                          className="icon-button delete-account-button"
                          type="button"
                          disabled={Number(account.balance) !== 0}
                          aria-label={`Delete ${account.accountType.toLowerCase()} account ending ${account.id.slice(-4)}`}
                          title={Number(account.balance) === 0
                            ? 'Delete account'
                            : 'Account must have a zero balance to delete'}
                          onClick={() => {
                            setDeleteStatus({ type: 'idle', message: '' })
                            setDeleteTarget({ account, customerId: null })
                          }}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="page-content customers-page">
          <div className="page-title-row">
            <h1>All customers</h1>
          </div>

          {status.type === 'loading' && <p role="status">{status.message}</p>}
          {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
          {status.type === 'success' && customers.length === 0 && <p>No customers found.</p>}
          {customers.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Username</th>
                    <th scope="col">Accounts</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <Fragment key={customer.id}>
                        <tr>
                          <td>{customer.name}</td>
                          <td>{customer.username || '-'}</td>
                          <td>
                            <div className="account-actions">
                              <button
                                className="account-toggle"
                                type="button"
                                aria-expanded={expandedCustomerId === customer.id}
                                aria-controls={`customer-accounts-${customer.id}`}
                                onClick={() => toggleCustomerAccounts(customer.id)}
                              >
                                {expandedCustomerId === customer.id ? 'Hide accounts' : 'Show accounts'}
                              </button>
                              <button
                                className="account-toggle"
                                type="button"
                                aria-label={`Add account for ${customer.name}`}
                                onClick={() => openAccountDialog(customer)}
                              >
                                Add account
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedCustomerId === customer.id && (
                          <tr className="account-details-row">
                            <td id={`customer-accounts-${customer.id}`} colSpan={3}>
                              {accountsByCustomer[customer.id]?.status === 'loading' && (
                                <p role="status">Loading accounts...</p>
                              )}
                              {accountsByCustomer[customer.id]?.status === 'error' && (
                                <p className="error-message" role="alert">
                                  {accountsByCustomer[customer.id].error}
                                </p>
                              )}
                              {accountsByCustomer[customer.id]?.status === 'success' &&
                                accountsByCustomer[customer.id].accounts.length === 0 && (
                                  <p>No accounts for this customer.</p>
                                )}
                              {accountsByCustomer[customer.id]?.status === 'success' &&
                                accountsByCustomer[customer.id].accounts.length > 0 && (
                                  <table aria-label={`${customer.name} accounts`}>
                                    <thead>
                                      <tr>
                                        <th scope="col">Account type</th>
                                        <th scope="col">Current balance</th>
                                        <th scope="col"><span className="sr-only">Delete</span></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {accountsByCustomer[customer.id].accounts.map((account) => (
                                        <tr key={account.id}>
                                          <td>{account.accountType}</td>
                                          <td>
                                            {new Intl.NumberFormat('en-US', {
                                              style: 'currency',
                                              currency: 'USD',
                                            }).format(Number(account.balance))}
                                          </td>
                                          <td>
                                            <button
                                              className="icon-button delete-account-button"
                                              type="button"
                                              disabled={Number(account.balance) !== 0}
                                              aria-label={`Delete ${customer.name}'s ${account.accountType.toLowerCase()} account ending ${account.id.slice(-4)}`}
                                              title={Number(account.balance) === 0
                                                ? 'Delete account'
                                                : 'Account must have a zero balance to delete'}
                                              onClick={() => {
                                                setDeleteStatus({ type: 'idle', message: '' })
                                                setDeleteTarget({ account, customerId: customer.id })
                                              }}
                                            >
                                              <Trash2 size={16} aria-hidden="true" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                            </td>
                          </tr>
                        )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {editingProfile && profile && (
        <dialog
          className="profile-dialog"
          ref={profileDialogRef}
          aria-labelledby="edit-account-title"
          onCancel={(event) => {
            if (profileStatus.type === 'loading') {
              event.preventDefault()
            } else {
              closeProfileEditor()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && profileStatus.type !== 'loading') {
              event.preventDefault()
              closeProfileEditor()
            }
          }}
        >
          <h2 id="edit-account-title">Edit profile</h2>
          {profileStatus.type === 'error' && (
            <p className="error-message" role="alert">{profileStatus.message}</p>
          )}
          <form className="auth-form profile-form" onSubmit={handleProfileSubmit}>
            <label>
              Name
              <input
                autoComplete="name"
                required
                value={profileDraft.name}
                onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
              />
            </label>
            <label>
              Username
              <input
                autoComplete="username"
                required
                value={profileDraft.username}
                onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value })}
              />
            </label>
            <label>
              New password (optional)
              <input
                autoComplete="new-password"
                minLength={8}
                type="password"
                value={profileDraft.newPassword}
                onChange={(event) => setProfileDraft({ ...profileDraft, newPassword: event.target.value, confirmPassword: '' })}
              />
            </label>
            {profileDraft.newPassword && (
              <label>
                Confirm new password
                <input
                  autoComplete="new-password"
                  required
                  type="password"
                  value={profileDraft.confirmPassword}
                  onChange={(event) => setProfileDraft({ ...profileDraft, confirmPassword: event.target.value })}
                />
              </label>
            )}
            {(profileDraft.username.trim() !== profile.username || profileDraft.newPassword) && (
              <label>
                Current password
                <input
                  autoComplete="current-password"
                  required
                  type="password"
                  value={profileDraft.currentPassword}
                  onChange={(event) => setProfileDraft({ ...profileDraft, currentPassword: event.target.value })}
                />
              </label>
            )}
            <div className="profile-actions">
              <button className="primary-button" type="submit" disabled={profileStatus.type === 'loading'}>
                {profileStatus.type === 'loading' ? 'Saving...' : 'Save changes'}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={profileStatus.type === 'loading'}
                onClick={closeProfileEditor}
              >
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}
      {accountDialogTarget && (
        <dialog
          className="profile-dialog account-dialog"
          ref={accountDialogRef}
          aria-labelledby="add-account-title"
          onCancel={(event) => {
            if (accountCreateStatus.type === 'loading') {
              event.preventDefault()
            } else {
              closeAccountDialog()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && accountCreateStatus.type !== 'loading') {
              event.preventDefault()
              closeAccountDialog()
            }
          }}
        >
          <h2 id="add-account-title">Add account{isAdmin ? ` for ${accountDialogTarget.name}` : ''}</h2>
          <form className="auth-form" onSubmit={handleCreateAccount}>
            <label>
              Account type
              <select value={newAccountType} onChange={(event) => setNewAccountType(event.target.value)}>
                <option value="SAVINGS">Savings</option>
                <option value="CHECKING">Checking</option>
              </select>
            </label>
            {accountCreateStatus.type === 'error' && (
              <p className="error-message" role="alert">{accountCreateStatus.message}</p>
            )}
            <div className="profile-actions">
              <button className="primary-button" type="submit" disabled={accountCreateStatus.type === 'loading'}>
                {accountCreateStatus.type === 'loading' ? 'Creating...' : 'Create account'}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={accountCreateStatus.type === 'loading'}
                onClick={closeAccountDialog}
              >
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}
      {transferSource && (
        <dialog
          className="profile-dialog transfer-dialog"
          ref={transferDialogRef}
          aria-labelledby="transfer-title"
          onCancel={(event) => {
            if (transferStatus.type === 'loading') {
              event.preventDefault()
            } else {
              closeTransferDialog()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && transferStatus.type !== 'loading') {
              event.preventDefault()
              closeTransferDialog()
            }
          }}
        >
          <h2 id="transfer-title">Transfer from {transferSource.accountType.toLowerCase()} account</h2>
          <form className="auth-form" onSubmit={handleTransfer}>
            <label>
              Amount
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                min="0.01"
                max={transferSource.balance}
                step="0.01"
                required
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
              />
            </label>
            <label>
              To account
              <select
                required
                value={transferDestinationId}
                onChange={(event) => setTransferDestinationId(event.target.value)}
              >
                {accounts.filter((account) => account.id !== transferSource.id).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountType} ending {account.id.slice(-4)} ({new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(Number(account.balance))})
                  </option>
                ))}
              </select>
            </label>
            {transferStatus.type === 'error' && (
              <p className="error-message" role="alert">{transferStatus.message}</p>
            )}
            <div className="profile-actions">
              <button className="primary-button" type="submit" disabled={transferStatus.type === 'loading'}>
                {transferStatus.type === 'loading' ? 'Transferring...' : 'Transfer'}
              </button>
              <button
                className="text-button"
                type="button"
                disabled={transferStatus.type === 'loading'}
                onClick={closeTransferDialog}
              >
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      )}
      {deleteTarget && (
        <dialog
          className="profile-dialog delete-dialog"
          ref={deleteDialogRef}
          aria-labelledby="delete-account-title"
          onCancel={(event) => {
            if (deleteStatus.type === 'loading') {
              event.preventDefault()
            } else {
              closeDeleteDialog()
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && deleteStatus.type !== 'loading') {
              event.preventDefault()
              closeDeleteDialog()
            }
          }}
        >
          <h2 id="delete-account-title">Delete account?</h2>
          <p>
            {deleteTarget.account.accountType} account ending {deleteTarget.account.id.slice(-4)} will be deleted,
            including its transaction history. This cannot be undone.
          </p>
          {deleteStatus.type === 'error' && (
            <p className="error-message" role="alert">{deleteStatus.message}</p>
          )}
          <div className="profile-actions">
            <button
              className="primary-button danger-button"
              type="button"
              disabled={deleteStatus.type === 'loading'}
              onClick={handleDeleteAccount}
            >
              {deleteStatus.type === 'loading' ? 'Deleting...' : 'Delete account'}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={deleteStatus.type === 'loading'}
              onClick={closeDeleteDialog}
            >
              Cancel
            </button>
          </div>
        </dialog>
      )}
    </main>
  )
}

export default App
