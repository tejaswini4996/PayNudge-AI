
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

function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
const [reminder, setReminder] = useState<{
  invoice_id: number
  customer_email: string
  subject: string
  message: string
  tone: string
  ai_generated: boolean
} | null>(null)

const [reminderLoading, setReminderLoading] = useState<number | null>(null)
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    description: '',
    amount: '',
    currency: 'USD',
    due_date: '',
  })

  const fetchInvoices = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/invoices')
      if (!response.ok) throw new Error('Failed to fetch invoices')
      const data: Invoice[] = await response.json()
      setInvoices(data)
      setError('')
    } catch {
      setError('Unable to load invoices. Check your backend.')
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
      const response = await fetch('http://127.0.0.1:8000/api/invoices', {
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
        const message = await response.text()
        throw new Error(message || 'Could not create invoice')
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
        `http://127.0.0.1:8000/api/invoices/${invoiceId}/reminder`,
        { method: 'POST' },
      )

      if (!response.ok) {
        throw new Error('Failed to generate reminder')
      }

      const data = await response.json()
      setReminder(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reminder generation failed')
    } finally {
      setReminderLoading(null)
    }
  }
  const paid = invoices.filter((invoice) => invoice.status.toLowerCase() === 'paid')
  const pending = invoices.filter((invoice) => invoice.status.toLowerCase() === 'pending')
  const overdue = pending.filter(
    (invoice) => new Date(invoice.due_date) < new Date(new Date().toDateString()),
  )

  const totalAmount = (items: Invoice[]) =>
    items.reduce((sum, invoice) => sum + invoice.amount, 0)

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="logo">PayNudge<span> AI</span></h2>
        <nav>
          <a className="active">ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¦ Dashboard</a>
          <a>ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¤ Invoices</a>
          <a>ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â€ Payment Collection</a>
          <a>ÃƒÂ¢Ã¢â‚¬â€Ã‚Â· Reminders</a>
          <a>ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ Settings</a>
        </nav>
        <div className="sidebar-bottom">
          <p>Smart collections powered by AI</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Welcome back! Here's your collection overview.</p>
          </div>
          <button
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            + Create Invoice
          </button>
        </header>

        {error && <p className="error-message">{error}</p>}

        <section className="stats">
          <div className="stat-card">
            <p>Total Invoices</p>
            <h2>{loading ? '...' : invoices.length}</h2>
            <span>All invoices</span>
          </div>
          <div className="stat-card">
            <p>Collected</p>
            <h2>{loading ? '...' : `${totalAmount(paid).toFixed(2)} USD`}</h2>
            <span>{paid.length} paid invoices</span>
          </div>
          <div className="stat-card">
            <p>Pending</p>
            <h2>{loading ? '...' : `${totalAmount(pending).toFixed(2)} USD`}</h2>
            <span>{pending.length} awaiting payment</span>
          </div>
          <div className="stat-card">
            <p>Overdue</p>
            <h2>{loading ? '...' : overdue.length}</h2>
            <span>Past due invoices</span>
          </div>
        </section>

        <section className="invoice-section">
          <div className="section-heading">
            <div>
              <h2>Recent Invoices</h2>
              <p>Live data from your PostgreSQL database.</p>
            </div>
            <button className="secondary-button" onClick={fetchInvoices}>
              Refresh
            </button>
          </div>

          {loading && <p>Loading invoices...</p>}

          {!loading && (
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
                    <th>AI Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>#{invoice.id}</td>
                      <td>
                        <strong>{invoice.customer_name}</strong>
                        <br />
                        <small>{invoice.customer_email}</small>
                      </td>
                      <td>{invoice.description}</td>
                      <td>{invoice.currency} {invoice.amount.toFixed(2)}</td>
                      <td>{invoice.due_date}</td>
                      <td>
                        <span className={`status ${invoice.status.toLowerCase()}`}>
                          {invoice.status}
                        </span>
                                            </td>
                      <td>
                        <button
                          className="secondary-button"
                          onClick={() => generateReminder(invoice.id)}
                          disabled={reminderLoading === invoice.id}
                        >
                          {reminderLoading === invoice.id ? 'Generating...' : 'Generate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length === 0 && <p>No invoices found.</p>}
            </div>
          )}
        </section>
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
            <p><strong>AI Generated:</strong> {reminder.ai_generated ? 'Yes' : 'No'}</p>
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
               
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Customer Name</label>
              <input
                required
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Enter customer name"
              />

              <label>Customer Email</label>
              <input
                required
                type="email"
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                placeholder="customer@example.com"
              />

              <label>Description</label>
              <input
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Enter invoice description"
              />

              <label>Amount</label>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Enter amount"
              />

              <label>Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
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
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />

              <button className="primary-button save-button" type="submit" disabled={saving}>
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
