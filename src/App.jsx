import { Fragment, useEffect, useState } from 'react'
import './App.css'

async function readResponse(response) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Request failed (${response.status})`,
    )
  }

  return data
}

function App() {
  const [page, setPage] = useState(() =>
    window.location.pathname === '/customers' ? 'customers' : 'home',
  )
  const [token, setToken] = useState(() => sessionStorage.getItem('bankapp-token') || '')
  const [customers, setCustomers] = useState([])
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [accountsByCustomer, setAccountsByCustomer] = useState({})
  const [credentials, setCredentials] = useState({ name: '', username: '', password: '' })
  const [isRegistering, setIsRegistering] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  useEffect(() => {
    function handlePopState() {
      setPage(window.location.pathname === '/customers' ? 'customers' : 'home')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (page !== 'customers' || !token) return

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
  }, [page, token])

  function navigate(path) {
    window.history.pushState({}, '', path)
    setPage(path === '/customers' ? 'customers' : 'home')
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

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify(loginDetails),
      })
      const loginData = await readResponse(loginResponse)

      if (!loginData?.token) {
        throw new Error('The login response did not include an access token.')
      }

      sessionStorage.setItem('bankapp-token', loginData.token)
      setToken(loginData.token)
      setStatus({ type: 'idle', message: '' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  function signOut() {
    sessionStorage.removeItem('bankapp-token')
    setToken('')
    setCustomers([])
    setExpandedCustomerId(null)
    setAccountsByCustomer({})
    setStatus({ type: 'idle', message: '' })
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
        {page === 'customers' && token && (
          <button className="text-button header-signout" type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </header>

      {page === 'home' ? (
        <section className="page-content home-page">
          <h1>Simple Bank</h1>
          <button className="primary-button" type="button" onClick={() => navigate('/customers')}>
            View customers
          </button>
        </section>
      ) : (
        <section className="page-content customers-page">
          <button className="text-button" type="button" onClick={() => navigate('/')}>
            Back
          </button>
          <div className="page-title-row">
            <h1>Customers</h1>
          </div>

          {token ? (
            <>
              {status.type === 'loading' && <p role="status">{status.message}</p>}
              {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
              {status.type === 'success' && customers.length === 0 && (
                <p>No customers found.</p>
              )}
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
            </>
          ) : (
            <div className="auth-section">
              <h2>{isRegistering ? 'Create an account' : 'Sign in to load customers'}</h2>
              {status.type === 'error' && <p className="error-message" role="alert">{status.message}</p>}
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                {isRegistering && (
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
                  {status.type === 'loading' ? status.message : isRegistering ? 'Create account' : 'Sign in'}
                </button>
              </form>
              <button
                className="text-button auth-toggle"
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering)
                  setStatus({ type: 'idle', message: '' })
                }}
              >
                {isRegistering ? 'Use an existing account' : 'Create a test account'}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default App
