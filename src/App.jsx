import { Fragment, useEffect, useState } from 'react'
import './App.css'

const EMPTY_CREDENTIALS = { name: '', username: '', password: '' }

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
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [accountsByCustomer, setAccountsByCustomer] = useState({})
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
    setExpandedCustomerId(null)
    setAccountsByCustomer({})
    setStatus({ type: 'idle', message: '' })
    navigate('/')
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
          <button className="text-button header-signout" type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </header>

      {page === 'home' || !token ? (
        <section className="page-content login-page">
          <div className="auth-section">
            <h1>{loginMode === 'admin' ? 'Admin login' : 'Customer login'}</h1>
            {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
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
          <h1>My accounts</h1>
          {status.type === 'loading' && <p role="status">{status.message}</p>}
          {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
          {status.type === 'success' && accounts.length === 0 && <p>No accounts found.</p>}
          {accounts.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Account type</th>
                    <th scope="col">Current balance</th>
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
                            <button
                              className="account-toggle"
                              type="button"
                              aria-expanded={expandedCustomerId === customer.id}
                              aria-controls={`customer-accounts-${customer.id}`}
                              onClick={() => toggleCustomerAccounts(customer.id)}
                            >
                              {expandedCustomerId === customer.id ? 'Hide accounts' : 'Show accounts'}
                            </button>
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
    </main>
  )
}

export default App
