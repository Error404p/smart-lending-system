import React, { useState, useEffect } from 'react';

const API_BASE = 'http://127.0.0.1:5000/api';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Navigation & View state
  const [view, setView] = useState(user ? 'dashboard' : 'login');
  const [activeTab, setActiveTab] = useState('catalogue'); // 'catalogue', 'loans', 'alerts'
  
  // Data state
  const [items, setItems] = useState([]);
  const [loans, setLoans] = useState([]);
  const [overdueAlerts, setOverdueAlerts] = useState([]);
  const [librarians, setLibrarians] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // Day 4: Server-Side Loan Query, Filter, Sort & Pagination states
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatus, setLoanStatus] = useState('all');
  const [loanItem, setLoanItem] = useState('all');
  const [loanBorrower, setLoanBorrower] = useState('all');
  const [loanSortBy, setLoanSortBy] = useState('createdAt');
  const [loanSortOrder, setLoanSortOrder] = useState('desc');
  const [loanPage, setLoanPage] = useState(1);
  const [loanLimit, setLoanLimit] = useState(5);
  const [loanTotalCount, setLoanTotalCount] = useState(0);
  const [loanTotalPages, setLoanTotalPages] = useState(1);
  
  // UI filter for librarian catalogue
  const [onlyMyCustodian, setOnlyMyCustodian] = useState(false);
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'request', 'custodians', 'actionNote', 'timeline'
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedTimeline, setSelectedTimeline] = useState([]);
  
  // Modal forms
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [assignCustodianId, setAssignCustodianId] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { type: 'issue'|'return'|'lost', loanId }
  
  // Feedback messages
  const [message, setMessage] = useState(null); // { text, type: 'success'|'error' }

  // Sync token and user in localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // Fetch initial data when logged in
  useEffect(() => {
    if (user && token) {
      fetchItems();
      if (user.role === 'librarian') {
        fetchOverdueAlerts();
        fetchLibrarians();
        fetchAllUsers();
      }
    }
  }, [user, token, onlyMyCustodian]);

  // Fetch loans whenever server-side query params change
  useEffect(() => {
    if (user && token) {
      fetchLoans();
    }
  }, [user, token, loanSearch, loanStatus, loanItem, loanBorrower, loanSortBy, loanSortOrder, loanPage, loanLimit]);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  };

  // Alert count badge updates periodically or on changes
  const fetchOverdueAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/loans/overdue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOverdueAlerts(data);
      }
    } catch (err) {
      console.error('Fetch overdue alerts error:', err);
    }
  };

  const showFeedback = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setToken(data.token);
      setUser(data.user);
      setView('dashboard');
      setUsername('');
      setPassword('');
      showFeedback(`Welcome back, ${data.user.username}!`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      setToken(data.token);
      setUser(data.user);
      setView('dashboard');
      setUsername('');
      setPassword('');
      showFeedback('Account created successfully! Public signups default to member.');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setView('login');
    setItems([]);
    setLoans([]);
    setOverdueAlerts([]);
    setLibrarians([]);
    setAllUsers([]);
    handleClearLoanFilters();
  };

  const handleClearLoanFilters = () => {
    setLoanSearch('');
    setLoanStatus('all');
    setLoanItem('all');
    setLoanBorrower('all');
    setLoanSortBy('createdAt');
    setLoanSortOrder('desc');
    setLoanPage(1);
  };

  // Catalogue Actions
  const fetchItems = async () => {
    try {
      const url = onlyMyCustodian ? `${API_BASE}/items/custodian` : `${API_BASE}/items`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch catalogue items');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newItemName, category: newItemCategory })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create item');
      setNewItemName('');
      setNewItemCategory('');
      fetchItems();
      showFeedback(`Created catalogue item: ${data.name}`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // Loan Actions
  const fetchLoans = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (loanSearch && loanSearch.trim()) queryParams.set('search', loanSearch.trim());
      if (loanStatus && loanStatus !== 'all') queryParams.set('status', loanStatus);
      if (loanItem && loanItem !== 'all') queryParams.set('item', loanItem);
      if (user?.role === 'librarian' && loanBorrower && loanBorrower !== 'all') queryParams.set('borrower', loanBorrower);
      if (loanSortBy) queryParams.set('sortBy', loanSortBy);
      if (loanSortOrder) queryParams.set('sortOrder', loanSortOrder);
      queryParams.set('page', loanPage);
      queryParams.set('limit', loanLimit);

      const res = await fetch(`${API_BASE}/loans?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch loans');
      const data = await res.json();
      setLoans(data.loans || []);
      setLoanTotalCount(data.totalCount || 0);
      setLoanTotalPages(data.totalPages || 1);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRequestLoanSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: selectedItem._id, dueDate, note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      setActiveModal(null);
      setDueDate('');
      setNote('');
      fetchItems();
      fetchLoans();
      showFeedback(`Loan requested for ${selectedItem.name}`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleLoanActionSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = `${API_BASE}/loans/${pendingAction.loanId}/${pendingAction.type}`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Action ${pendingAction.type} failed`);
      setActiveModal(null);
      setNote('');
      setPendingAction(null);
      fetchItems();
      fetchLoans();
      fetchOverdueAlerts();
      showFeedback(`Loan state updated successfully!`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // Alert dismiss action
  const handleDismissAlert = async (loanId) => {
    try {
      const res = await fetch(`${API_BASE}/loans/${loanId}/dismiss-alert`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Dismissal failed');
      fetchOverdueAlerts();
      showFeedback('Overdue alert dismissed.');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // Timeline history action
  const handleViewTimeline = async (loanId, itemTitle) => {
    try {
      const res = await fetch(`${API_BASE}/loans/${loanId}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Timeline fetch failed');
      setSelectedTimeline(data);
      setSelectedItem({ name: itemTitle });
      setActiveModal('timeline');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // Custodian management
  const fetchLibrarians = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/librarians`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLibrarians(data);
      }
    } catch (err) {
      console.error('Fetch librarians error:', err);
    }
  };

  const handleAssignCustodian = async (e) => {
    e.preventDefault();
    if (!assignCustodianId) return;
    try {
      const res = await fetch(`${API_BASE}/items/${selectedItem._id}/custodians`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: assignCustodianId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Custodian assignment failed');
      setAssignCustodianId('');
      // Update local modal selected item custodians
      const updatedItem = { ...selectedItem };
      if (!updatedItem.custodians) updatedItem.custodians = [];
      const librarianObj = librarians.find(l => l._id === assignCustodianId);
      if (librarianObj && !updatedItem.custodians.some(c => c._id === assignCustodianId)) {
        updatedItem.custodians.push(librarianObj);
      }
      setSelectedItem(updatedItem);
      fetchItems();
      showFeedback('Custodian assigned successfully.');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRemoveCustodian = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/items/${selectedItem._id}/custodians/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Custodian removal failed');
      // Update local modal selected item custodians
      const updatedItem = { ...selectedItem };
      updatedItem.custodians = updatedItem.custodians.filter(c => c._id !== userId);
      setSelectedItem(updatedItem);
      fetchItems();
      showFeedback('Custodian removed successfully.');
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const daysOverdue = (dueDateStr) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diff = now - due;
    if (diff <= 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-brand">
          Asset<span>Lending</span>
        </div>
        {user && (
          <div className="nav-links">
            <button 
              className={`nav-item ${activeTab === 'catalogue' ? 'active' : ''}`}
              onClick={() => { setActiveTab('catalogue'); fetchItems(); }}
            >
              Catalogue
            </button>
            <button 
              className={`nav-item ${activeTab === 'loans' ? 'active' : ''}`}
              onClick={() => { setActiveTab('loans'); fetchLoans(); }}
            >
              {user.role === 'librarian' ? 'All Loans' : 'My Loans'}
            </button>
            
            {user.role === 'librarian' && (
              <button 
                className={`nav-alert-btn nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
                onClick={() => { setActiveTab('alerts'); fetchOverdueAlerts(); }}
              >
                Alerts
                {overdueAlerts.length > 0 && (
                  <span className="nav-badge">{overdueAlerts.length}</span>
                )}
              </button>
            )}
            
            <div className="user-profile">
              <span>{user.username}</span>
              <span className="user-role-badge">{user.role}</span>
            </div>
            
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Feedback message */}
        {message && (
          <div className={`message-box message-box-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <div className="auth-container">
            <div className="auth-card">
              <h2 className="auth-title">Log In</h2>
              <p className="auth-subtitle">Access the Asset Lending System</p>
              
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-control"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-control"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Sign In
                </button>
              </form>
              <div className="form-footer">
                Don't have an account?{' '}
                <button className="nav-item form-link" onClick={() => setView('register')}>
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REGISTER VIEW */}
        {view === 'register' && (
          <div className="auth-container">
            <div className="auth-card">
              <h2 className="auth-title">Sign Up</h2>
              <p className="auth-subtitle">Create a public member account</p>
              
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-control"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-control"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                  Create Account
                </button>
              </form>
              <div className="form-footer">
                Already have an account?{' '}
                <button className="nav-item form-link" onClick={() => setView('login')}>
                  Log In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOGGED IN DASHBOARD VIEW */}
        {view === 'dashboard' && user && (
          <div>
            {/* OVERDUE BANNER FOR LIBRARIANS */}
            {user.role === 'librarian' && overdueAlerts.length > 0 && activeTab !== 'alerts' && (
              <div className="alert-banner">
                <span className="alert-message">
                  ⚠️ Action Required: There are {overdueAlerts.length} overdue item checkouts active.
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('alerts')}>
                  View Alerts
                </button>
              </div>
            )}

            {/* TAB: CATALOGUE */}
            {activeTab === 'catalogue' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Catalogue items</h2>
                
                {user.role === 'librarian' && (
                  <div className="filter-tabs">
                    <button 
                      className={`filter-tab ${!onlyMyCustodian ? 'active' : ''}`}
                      onClick={() => setOnlyMyCustodian(false)}
                    >
                      Full Catalogue
                    </button>
                    <button 
                      className={`filter-tab ${onlyMyCustodian ? 'active' : ''}`}
                      onClick={() => setOnlyMyCustodian(true)}
                    >
                      My Custodian Items Only
                    </button>
                  </div>
                )}

                <div className="grid-cols-3" style={{ alignItems: 'start' }}>
                  {/* Catalogue Grid */}
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {items.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>No items found in catalogue.</p>
                    ) : (
                      items.map(item => (
                        <div className="card" key={item._id}>
                          <div className="card-header">
                            <div>
                              <h3 className="card-title">{item.name}</h3>
                              <span className="card-subtitle">{item.category}</span>
                            </div>
                            <span className={`badge badge-${item.status}`}>
                              {item.status}
                            </span>
                          </div>
                          
                          {item.custodians && item.custodians.length > 0 && (
                            <div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>
                                Custodians:
                              </span>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {item.custodians.map(c => (
                                  <span key={c._id || c} className="user-role-badge" style={{ textTransform: 'none' }}>
                                    {c.username || 'Seeded Librarian'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="card-footer">
                            {user.role === 'member' && item.status === 'available' && (
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => { setSelectedItem(item); setActiveModal('request'); }}
                              >
                                Request Borrow
                              </button>
                            )}

                            {user.role === 'librarian' && (
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setSelectedItem(item); setActiveModal('custodians'); }}
                              >
                                Manage Custodians
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Catalogue Item Sidebar (Librarian only) */}
                  {user.role === 'librarian' && (
                    <div className="card">
                      <h3 className="card-title">Add New Asset</h3>
                      <form onSubmit={handleCreateItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Asset Name</label>
                          <input 
                            type="text" 
                            className="form-control"
                            required
                            placeholder="e.g. ThinkPad L14"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Category</label>
                          <input 
                            type="text" 
                            className="form-control"
                            required
                            placeholder="e.g. Laptops"
                            value={newItemCategory}
                            onChange={(e) => setNewItemCategory(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Add to Catalogue
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: LOANS */}
            {activeTab === 'loans' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>
                  {user.role === 'librarian' ? 'System Checkout History & Requests' : 'My Requests & Loans'}
                </h2>

                {/* Server-Side Query Controls */}
                <div className="query-container">
                  {/* Search Row */}
                  <div className="query-search-row">
                    <input 
                      type="text"
                      className="form-control query-search-input"
                      placeholder={user.role === 'librarian' ? "Search item title or borrower username..." : "Search item title..."}
                      value={loanSearch}
                      onChange={(e) => { setLoanSearch(e.target.value); setLoanPage(1); }}
                    />
                    {loanSearch && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setLoanSearch(''); setLoanPage(1); }}>
                        Clear Search
                      </button>
                    )}
                  </div>

                  {/* Filters Grid */}
                  <div className="query-filters-grid">
                    {/* Status Filter */}
                    <div>
                      <label className="filter-label">Status</label>
                      <select 
                        className="query-select"
                        value={loanStatus}
                        onChange={(e) => { setLoanStatus(e.target.value); setLoanPage(1); }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="Requested">Requested</option>
                        <option value="Issued">Issued</option>
                        <option value="Returned">Returned</option>
                        <option value="Lost">Lost</option>
                      </select>
                    </div>

                    {/* Item Filter */}
                    <div>
                      <label className="filter-label">Filter by Asset</label>
                      <select 
                        className="query-select"
                        value={loanItem}
                        onChange={(e) => { setLoanItem(e.target.value); setLoanPage(1); }}
                      >
                        <option value="all">All Assets</option>
                        {items.map(i => (
                          <option key={i._id} value={i._id}>{i.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Borrower Filter (Librarians Only) */}
                    {user.role === 'librarian' && (
                      <div>
                        <label className="filter-label">Filter by Borrower</label>
                        <select 
                          className="query-select"
                          value={loanBorrower}
                          onChange={(e) => { setLoanBorrower(e.target.value); setLoanPage(1); }}
                        >
                          <option value="all">All Borrowers</option>
                          {allUsers.map(u => (
                            <option key={u._id} value={u._id}>{u.username} ({u.role})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Sort By Field */}
                    <div>
                      <label className="filter-label">Sort By</label>
                      <select 
                        className="query-select"
                        value={loanSortBy}
                        onChange={(e) => { setLoanSortBy(e.target.value); setLoanPage(1); }}
                      >
                        <option value="createdAt">Request / Created Date</option>
                        <option value="dueDate">Due Date</option>
                        <option value="borrowDate">Borrow Date</option>
                        <option value="status">Status</option>
                      </select>
                    </div>

                    {/* Items Per Page */}
                    <div>
                      <label className="filter-label">Page Size</label>
                      <select 
                        className="query-select"
                        value={loanLimit}
                        onChange={(e) => { setLoanLimit(Number(e.target.value)); setLoanPage(1); }}
                      >
                        <option value={5}>5 per page</option>
                        <option value={10}>10 per page</option>
                        <option value={20}>20 per page</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions & Sort Direction Row */}
                  <div className="query-actions-row">
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        type="button"
                        className="sort-direction-btn"
                        onClick={() => { setLoanSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setLoanPage(1); }}
                      >
                        {loanSortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={handleClearLoanFilters}
                      >
                        Reset All Filters
                      </button>
                    </div>

                    <div className="pagination-info">
                      Matching Loans: <strong>{loanTotalCount}</strong>
                    </div>
                  </div>
                </div>

                {/* Results Summary */}
                <div className="loan-results-summary">
                  <span>
                    Showing {loans.length} of {loanTotalCount} matching records (Page {loanPage} of {loanTotalPages})
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {loans.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>No request or checkout records matching current query.</p>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ marginTop: '0.75rem' }} 
                        onClick={handleClearLoanFilters}
                      >
                        Reset Filters
                      </button>
                    </div>
                  ) : (
                    loans.map(loan => (
                      <div className="card" key={loan._id}>
                        <div className="card-header">
                          <div>
                            <h3 className="card-title">{loan.item?.name || 'Unknown Item'}</h3>
                            <span className="card-subtitle">
                              Borrower: {loan.borrower?.username} | Category: {loan.item?.category}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {loan.isOverdue && (
                              <span className="badge badge-lost" style={{ backgroundColor: '#ef444430', color: '#ef4444' }}>
                                OVERDUE
                              </span>
                            )}
                            <span className={`badge badge-${loan.status.toLowerCase()}`}>
                              {loan.status}
                            </span>
                          </div>
                        </div>

                        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Request/Create Date</span>
                            <span style={{ fontSize: '0.95rem' }}>{formatDate(loan.createdAt || loan.borrowDate)}</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Borrow Date</span>
                            <span style={{ fontSize: '0.95rem' }}>{formatDate(loan.borrowDate)}</span>
                          </div>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Due Date</span>
                            <span style={{ fontSize: '0.95rem', color: loan.isOverdue ? '#ef4444' : 'inherit', fontWeight: loan.isOverdue ? 'bold' : 'normal' }}>
                              {formatDate(loan.dueDate)}
                            </span>
                          </div>
                          {loan.returnedDate && (
                            <div>
                              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Returned Date</span>
                              <span style={{ fontSize: '0.95rem' }}>{formatDate(loan.returnedDate)}</span>
                            </div>
                          )}
                        </div>

                        <div className="card-footer">
                          {user.role === 'librarian' && loan.status === 'Requested' && (
                            <button 
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setPendingAction({ type: 'issue', loanId: loan._id });
                                setActiveModal('actionNote');
                              }}
                            >
                              Issue Asset
                            </button>
                          )}
                          
                          {user.role === 'librarian' && loan.status === 'Issued' && (
                            <>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setPendingAction({ type: 'return', loanId: loan._id });
                                  setActiveModal('actionNote');
                                }}
                              >
                                Mark Returned
                              </button>
                              <button 
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  setPendingAction({ type: 'lost', loanId: loan._id });
                                  setActiveModal('actionNote');
                                }}
                              >
                                Mark Lost
                              </button>
                            </>
                          )}

                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewTimeline(loan._id, loan.item?.name)}
                          >
                            View Timeline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Server-Side Pagination Bar */}
                {loanTotalCount > 0 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Page <strong>{loanPage}</strong> of <strong>{loanTotalPages}</strong> ({loanTotalCount} total items)
                    </div>
                    <div className="pagination-controls">
                      <button 
                        className="pagination-btn"
                        disabled={loanPage <= 1}
                        onClick={() => setLoanPage(1)}
                      >
                        « First
                      </button>
                      <button 
                        className="pagination-btn"
                        disabled={loanPage <= 1}
                        onClick={() => setLoanPage(prev => Math.max(1, prev - 1))}
                      >
                        ‹ Prev
                      </button>
                      <span className="pagination-page-indicator">
                        {loanPage} / {loanTotalPages}
                      </span>
                      <button 
                        className="pagination-btn"
                        disabled={loanPage >= loanTotalPages}
                        onClick={() => setLoanPage(prev => Math.min(loanTotalPages, prev + 1))}
                      >
                        Next ›
                      </button>
                      <button 
                        className="pagination-btn"
                        disabled={loanPage >= loanTotalPages}
                        onClick={() => setLoanPage(loanTotalPages)}
                      >
                        Last »
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: OVERDUE ALERTS (Librarian only) */}
            {activeTab === 'alerts' && user.role === 'librarian' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Active Overdue Alerts</h2>
                
                {overdueAlerts.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No active overdue checkouts found.</p>
                ) : (
                  <div className="alerts-list">
                    {overdueAlerts.map(alert => (
                      <div className="alert-item" key={alert._id}>
                        <div className="alert-info">
                          <span className="alert-item-name">{alert.item?.name}</span>
                          <span className="alert-borrower">Borrowed by: {alert.borrower?.username}</span>
                          <span className="alert-due-date">
                            Due on {formatDate(alert.dueDate)} ({daysOverdue(alert.dueDate)} days overdue)
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewTimeline(alert._id, alert.item?.name)}
                          >
                            View Timeline
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDismissAlert(alert._id)}
                          >
                            Dismiss Alert
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border-color)', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Smart Lending System © 2026. Made with Vanilla CSS.
      </footer>

      {/* ================= MODALS ================= */}

      {/* MODAL: REQUEST BORROW */}
      {activeModal === 'request' && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Request Borrow: {selectedItem.name}</h3>
              <button className="nav-item" onClick={() => setActiveModal(null)} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <form onSubmit={handleRequestLoanSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Return Due Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Note for Librarian (optional)</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={note}
                    placeholder="Provide any context for your borrow request..."
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ACTION NOTE (Librarian Action Confirmation Note) */}
      {activeModal === 'actionNote' && pendingAction && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title" style={{ textTransform: 'capitalize' }}>
                Confirm: {pendingAction.type} Loan
              </h3>
              <button className="nav-item" onClick={() => { setActiveModal(null); setPendingAction(null); }} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <form onSubmit={handleLoanActionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Add a Note for this Timeline Update (optional)</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={note}
                    placeholder="Enter details, reason, or condition checks..."
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveModal(null); setPendingAction(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Confirm action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE CUSTODIANS */}
      {activeModal === 'custodians' && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Custodians: {selectedItem.name}</h3>
              <button className="nav-item" onClick={() => { setActiveModal(null); setSelectedItem(null); }} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <div className="modal-body">
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                  Current Custodians
                </span>
                <div className="custodians-list">
                  {selectedItem.custodians && selectedItem.custodians.length > 0 ? (
                    selectedItem.custodians.map(c => (
                      <div className="custodian-tag" key={c._id}>
                        {c.username}
                        <button className="custodian-remove-btn" onClick={() => handleRemoveCustodian(c._id)}>
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No custodians assigned yet.</p>
                  )}
                </div>
              </div>
              
              <form onSubmit={handleAssignCustodian} style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Assign New Custodian</label>
                  <select 
                    className="form-control"
                    required
                    value={assignCustodianId}
                    onChange={(e) => setAssignCustodianId(e.target.value)}
                  >
                    <option value="">-- Select a Librarian --</option>
                    {librarians.map(lib => (
                      <option key={lib._id} value={lib._id}>
                        {lib.username}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Assign Librarian
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW HISTORY TIMELINE */}
      {activeModal === 'timeline' && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Loan Timeline: {selectedItem.name}</h3>
              <button className="nav-item" onClick={() => { setActiveModal(null); setSelectedItem(null); }} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div className="timeline">
                {selectedTimeline.map((history, idx) => (
                  <div className="timeline-item active" key={history._id}>
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-author">
                          {history.changedBy?.username} ({history.changedBy?.role})
                        </span>
                        <span className="timeline-date">{formatDate(history.createdAt)}</span>
                      </div>
                      <span className={`badge badge-${history.state.toLowerCase()}`} style={{ display: 'inline-block' }}>
                        {history.state}
                      </span>
                      {history.note && (
                        <div className="timeline-note">
                          <strong>Note:</strong> {history.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveModal(null); setSelectedItem(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
