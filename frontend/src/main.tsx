import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'

interface Invoice {
  id: number
  customer_name: string
  customer_email: string
  description: string
  amount: number
  currency: string
  due_date: string
  status: string
}

interface Reminder {
  invoice_id: number
  customer_email: string
  subject: string
  message: string
  tone: string
  ai_generated: boolean
}

type Page =
  | 'Dashboard'
  | 'Invoices'
  | 'Payment Collection'
  | 'Reminders'
  | 'Settings'

const API_URL = import.meta.env.VITE_API_BASE_URL || ''

function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [reminder, setReminder] = useState<Reminder | null>(null)
  const [reminderLoading, setReminderLoading] = useState<number | null>(null)
  const [activePage, setActivePage] = useState<Page>('Dashboard')

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    description: '',
    amount: '',
    currency: 'USD',
    due_date: '',
  })

  const fetchInvoices = async () => {
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/invoices`)

      if (!response.ok) {
        throw new Error('Failed to fetch invoices')
      }

      const data: Invoice[] = await response.json()
      setInvoices(data)
      setError('')
    } catch {
      setError('Unable to load invoices. Check your backend deployment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text() || 'Could not create invoice')
      }

      const newInvoice: Invoice = await response.json()

      setInvoices((current) => [newInvoice, ...current])
      setShowForm(false)

      setForm({
        customer_name: '',
        customer_email: '',
        description: '',
        amount: '',
        currency: 'USD',
        due_date: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const generateReminder = async (invoiceId: number) => {
    setReminderLoading(invoiceId)
    setReminder(null)
    setError('')

    try {
      const response = await fetch(
        `${API_URL}/api/invoices/${invoiceId}/reminder`,
        { method: 'POST' },
      )

      if (!response.ok) {
        throw new Error('Failed to generate reminder')
      }

      const data: Reminder = await response.json()
      setReminder(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reminder generation failed')
    } finally {
      setReminderLoading(null)
    }
  }

  const paid = invoices.filter(
    (invoice) => invoice.status.toLowerCase() === 'paid',
  )

  const pending = invoices.filter(
    (invoice) => invoice.status.toLowerCase() === 'pending',
  )

  const overdue = pending.filter(
    (invoice) =>
      new Date(invoice.due_date) < new Date(new Date().toDateString()),
  )

  const totalAmount = (items: Invoice[]) =>
    items.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)

  const renderInvoiceTable = (
    items: Invoice[],
    showReminderButton = false,
  ) => (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Due Date</th>
            <th>Status</th>
            {showReminderButton && <th>AI Reminder</th>}
          </tr>
        </thead>

        <tbody>
          {items.map((invoice) => (
            <tr key={invoice.id}>
              <td>#{invoice.id}</td>
              <td>
                <strong>{invoice.customer_name}</strong>
                <br />
                <small>{invoice.customer_email}</small>
              </td>
              <td>{invoice.description}</td>
              <td>
                {invoice.currency} {Number(invoice.amount).toFixed(2)}
              </td>
              <td>{invoice.due_date}</td>
              <td>
                <span className={`status ${invoice.status.toLowerCase()}`}>
                  {invoice.status}
                </span>
              </td>

              {showReminderButton && (
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => generateReminder(invoice.id)}
                    disabled={
                      reminderLoading === invoice.id ||
                      invoice.status.toLowerCase() === 'paid'
                    }
                  >
                    {reminderLoading === invoice.id
                      ? 'Generating...'
                      : 'Generate'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="empty-message">No invoices found.</p>
      )}
    </div>
  )

  const pageDescriptions: Record<Page, string> = {
    Dashboard: "Welcome back! Here's your collection overview.",
    Invoices: 'View and manage all your invoices.',
    'Payment Collection': 'Track paid and outstanding payments.',
    Reminders: 'Generate AI-powered payment reminders.',
    Settings: 'Application and integration information.',
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="logo">
          PayNudge<span> AI</span>
        </h2>

        <nav>
          {(
            [
              'Dashboard',
              'Invoices',
              'Payment Collection',
              'Reminders',
              'Settings',
            ] as Page[]
          ).map((page) => (
            <button
              key={page}
              type="button"
              className={activePage === page ? 'active' : ''}
              onClick={() => {
                setActivePage(page)
                setError('')
              }}
            >
              {page}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <p>Smart collections powered by AI</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{activePage}</h1>
            <p>{pageDescriptions[activePage]}</p>
          </div>

          {(activePage === 'Dashboard' || activePage === 'Invoices') && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowForm(true)}
            >
              + Create Invoice
            </button>
          )}
        </header>

        {error && <p className="error-message">{error}</p>}

        {loading ? (
          <p className="page-loading">Loading invoices...</p>
        ) : (
          <>
            {activePage === 'Dashboard' && (
              <>
                <section className="stats">
                  <div className="stat-card">
                    <p>Total Invoices</p>
                    <h2>{invoices.length}</h2>
                    <span>All invoices</span>
                  </div>

                  <div className="stat-card">
                    <p>Collected</p>
                    <h2>{totalAmount(paid).toFixed(2)} USD</h2>
                    <span>{paid.length} paid invoices</span>
                  </div>

                  <div className="stat-card">
                    <p>Pending</p>
                    <h2>{totalAmount(pending).toFixed(2)} USD</h2>
                    <span>{pending.length} awaiting payment</span>
                  </div>

                  <div className="stat-card">
                    <p>Overdue</p>
                    <h2>{overdue.length}</h2>
                    <span>Past due invoices</span>
                  </div>
                </section>

                <section className="invoice-section">
                  <div className="section-heading">
                    <div>
                      <h2>Recent Invoices</h2>
                      <p>Live data from your PostgreSQL database.</p>
                    </div>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={fetchInvoices}
                    >
                      Refresh
                    </button>
                  </div>

                  {renderInvoiceTable(invoices.slice(0, 5))}
                </section>
              </>
            )}

            {activePage === 'Invoices' && (
              <section className="invoice-section">
                <div className="section-heading">
                  <div>
                    <h2>All Invoices</h2>
                    <p>{invoices.length} invoices in your database.</p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={fetchInvoices}
                  >
                    Refresh
                  </button>
                </div>

                {renderInvoiceTable(invoices, true)}
              </section>
            )}

            {activePage === 'Payment Collection' && (
              <>
                <section className="stats">
                  <div className="stat-card">
                    <p>Total Collected</p>
                    <h2>{totalAmount(paid).toFixed(2)} USD</h2>
                    <span>{paid.length} paid invoices</span>
                  </div>

                  <div className="stat-card">
                    <p>Outstanding</p>
                    <h2>{totalAmount(pending).toFixed(2)} USD</h2>
                    <span>{pending.length} pending invoices</span>
                  </div>

                  <div className="stat-card">
                    <p>Overdue</p>
                    <h2>{overdue.length}</h2>
                    <span>Past due invoices</span>
                  </div>

                  <div className="stat-card">
                    <p>Collection Rate</p>
                    <h2>
                      {invoices.length
                        ? `${((paid.length / invoices.length) * 100).toFixed(1)}%`
                        : '0%'}
                    </h2>
                    <span>By invoice count</span>
                  </div>
                </section>

                <section className="invoice-section">
                  <div className="section-heading">
                    <div>
                      <h2>Payment Records</h2>
                      <p>Paid and outstanding invoice records.</p>
                    </div>
                  </div>

                  {renderInvoiceTable(invoices)}
                </section>
              </>
            )}

            {activePage === 'Reminders' && (
              <section className="invoice-section">
                <div className="section-heading">
                  <div>
                    <h2>Payment Reminders</h2>
                    <p>
                      Generate reminders for invoices that have not been paid.
                    </p>
                  </div>
                </div>

                {renderInvoiceTable(
                  invoices.filter(
                    (invoice) => invoice.status.toLowerCase() !== 'paid',
                  ),
                  true,
                )}
              </section>
            )}

            {activePage === 'Settings' && (
              <section className="invoice-section settings-section">
                <h2>Settings</h2>
                <p>
                  PayNudge AI application information and integration status.
                </p>

                <div className="settings-item">
                  <strong>Application</strong>
                  <span>PayNudge AI</span>
                </div>

                <div className="settings-item">
                  <strong>Backend</strong>
                  <span>FastAPI</span>
                </div>

                <div className="settings-item">
                  <strong>Database</strong>
                  <span>PostgreSQL (Neon)</span>
                </div>

                <div className="settings-item">
                  <strong>AI reminders</strong>
                  <span>Groq integration configured through environment variables</span>
                </div>

                <p className="settings-note">
                  Secret keys and deployment settings are managed securely in
                  your Vercel project environment variables.
                </p>
              </section>
            )}
          </>
        )}
      </main>

      {reminder && (
        <div className="modal-overlay">
          <div className="invoice-modal">
            <div className="modal-heading">
              <h2>AI Payment Reminder</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setReminder(null)}
              >
                ×
              </button>
            </div>

            <p><strong>To:</strong> {reminder.customer_email}</p>
            <p><strong>Subject:</strong> {reminder.subject}</p>
            <p><strong>Tone:</strong> {reminder.tone}</p>
            <p>
              <strong>AI Generated:</strong>{' '}
              {reminder.ai_generated ? 'Yes' : 'No'}
            </p>

            <div className="reminder-message">
              {reminder.message}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="invoice-modal">
            <div className="modal-heading">
              <h2>Create New Invoice</h2>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Customer Name</label>
              <input
                required
                value={form.customer_name}
                onChange={(e) =>
                  setForm({ ...form, customer_name: e.target.value })
                }
                placeholder="Enter customer name"
              />

              <label>Customer Email</label>
              <input
                required
                type="email"
                value={form.customer_email}
                onChange={(e) =>
                  setForm({ ...form, customer_email: e.target.value })
                }
                placeholder="customer@example.com"
              />

              <label>Description</label>
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Enter invoice description"
              />

              <label>Amount</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
                placeholder="Enter amount"
              />

              <label>Currency</label>
              <select
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value })
                }
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>

              <label>Due Date</label>
              <input
                required
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value })
                }
              />

              <button
                className="primary-button save-button"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)