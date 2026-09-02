import React, { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const API_BASE = 'http://127.0.0.1:5000/api';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  
  // Navigation & View state
  const [view, setView] = useState(user ? 'dashboard' : 'login');
  const [activeTab, setActiveTab] = useState(user?.role === 'librarian' ? 'dashboard-view' : 'catalogue'); // 'dashboard-view', 'catalogue', 'loans', 'alerts'
  
  // Data state
  const [items, setItems] = useState([]);
  const [loans, setLoans] = useState([]);
  const [overdueAlerts, setOverdueAlerts] = useState([]);
  const [librarians, setLibrarians] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  
  // Server-Side Loan Query, Filter, Sort & Pagination states
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatus, setLoanStatus] = useState('all');
  const [loanItem, setLoanItem] = useState('all');
  const [loanBorrower, setLoanBorrower] = useState('all');
  const [loanSortBy, setLoanSortBy] = useState('createdAt');
  const [loanSortOrder, setLoanSortOrder] = useState('desc');
  const [loanPage, setLoanPage] = useState(1);
  const [loanLimit, setLoanLimit] = useState(10);
  const [loanTotalCount, setLoanTotalCount] = useState(0);
  const [loanTotalPages, setLoanTotalPages] = useState(1);
  
  // UI filter for librarian catalogue
  const [onlyMyCustodian, setOnlyMyCustodian] = useState(false);
  
  // Bulk Actions State
  const [selectedLoanIds, setSelectedLoanIds] = useState([]);
  const [bulkReturnNote, setBulkReturnNote] = useState('');
  const [bulkReturnReport, setBulkReturnReport] = useState(null);
  
  // CSV Import State
  const [csvInputText, setCsvInputText] = useState('');
  const [csvImportReport, setCsvImportReport] = useState(null);
  const [importingCsv, setImportingCsv] = useState(false);
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'request', 'custodians', 'actionNote', 'timeline', 'bulkImport', 'bulkReturn', 'bulkReturnReport', 'csvImportReport'
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

  // Chart canvas ref
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

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
        if (activeTab === 'dashboard-view') {
          fetchDashboardStats();
        }
      }
    }
  }, [user, token, onlyMyCustodian, activeTab]);

  // Fetch loans whenever server-side query params change
  useEffect(() => {
    if (user && token && activeTab === 'loans') {
      fetchLoans();
    }
  }, [user, token, loanSearch, loanStatus, loanItem, loanBorrower, loanSortBy, loanSortOrder, loanPage, loanLimit, activeTab]);

  // Render Chart.js when dashboard stats are available and on the dashboard tab
  useEffect(() => {
    if (activeTab === 'dashboard-view' && dashboardStats && chartCanvasRef.current) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const labels = dashboardStats.weeklyReturns.map(w => w.label);
      const dataValues = dashboardStats.weeklyReturns.map(w => w.count);

      chartInstanceRef.current = new Chart(chartCanvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Items Returned',
            data: dataValues,
            backgroundColor: '#4f46e5',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.parsed.y} item(s) returned`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                color: '#94a3b8',
                precision: 0
              },
              grid: {
                color: '#2a354f'
              }
            },
            x: {
              ticks: {
                color: '#94a3b8'
              },
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, dashboardStats]);

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

  const fetchDashboardStats = async () => {
    if (user?.role !== 'librarian') return;
    try {
      setLoadingDashboard(true);
      const res = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: Dashboard is librarian-only');
        }
        throw new Error('Failed to load dashboard metrics');
      }
      const data = await res.json();
      setDashboardStats(data);
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setLoadingDashboard(false);
    }
  };

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
      setActiveTab(data.user.role === 'librarian' ? 'dashboard-view' : 'catalogue');
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
      setActiveTab('catalogue');
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
    setDashboardStats(null);
    setSelectedLoanIds([]);
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
    setSelectedLoanIds([]);
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

  // CSV Bulk Import Action
  const handleCsvBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!csvInputText.trim()) {
      showFeedback('Please enter or paste CSV content', 'error');
      return;
    }

    try {
      setImportingCsv(true);
      const res = await fetch(`${API_BASE}/items/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ csvData: csvInputText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk import failed');
      
      setCsvImportReport(data);
      setActiveModal('csvImportReport');
      setCsvInputText('');
      fetchItems();
      showFeedback(`Import complete: ${data.importedCount} added, ${data.failedCount} failed.`);
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setImportingCsv(false);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvInputText(event.target.result);
    };
    reader.readAsText(file);
  };

  const loadSampleCsvTemplate = () => {
    const sample = `Name,Category\nCanon EOS R5,Cameras\nSony FX3 Cinema Camera,Cameras\nZoom H6 Audio Recorder,Audio\nSennheiser MKE 600 Shotgun Mic,Audio\nEpson Pro EX9240 Wireless Projector,Projectors\nDeWalt 20V Max Cordless Drill,Tools`;
    setCsvInputText(sample);
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

  // Bulk Return Actions
  const handleToggleSelectLoan = (id) => {
    setSelectedLoanIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllIssued = () => {
    const issuedLoans = loans.filter(l => l.status === 'Issued').map(l => l._id);
    const allSelected = issuedLoans.length > 0 && issuedLoans.every(id => selectedLoanIds.includes(id));
    if (allSelected) {
      setSelectedLoanIds(prev => prev.filter(id => !issuedLoans.includes(id)));
    } else {
      setSelectedLoanIds(prev => Array.from(new Set([...prev, ...issuedLoans])));
    }
  };

  const handleBulkReturnSubmit = async (e) => {
    e.preventDefault();
    if (selectedLoanIds.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/loans/bulk-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          loanIds: selectedLoanIds,
          note: bulkReturnNote
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bulk return failed');

      setBulkReturnReport(data);
      setActiveModal('bulkReturnReport');
      setSelectedLoanIds([]);
      setBulkReturnNote('');
      fetchLoans();
      fetchItems();
      fetchOverdueAlerts();
      showFeedback(`Bulk return finished: ${data.successCount} returned, ${data.rejectedCount} rejected.`);
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  // CSV Export Active Loans
  const handleExportActiveLoans = async () => {
    try {
      const res = await fetch(`${API_BASE}/loans/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Access denied: Librarian only');
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `active-loans-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showFeedback('Active loans exported successfully as CSV.');
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

  const issuedLoansOnCurrentPage = loans.filter(l => l.status === 'Issued');
  const allCurrentPageIssuedSelected = issuedLoansOnCurrentPage.length > 0 && 
    issuedLoansOnCurrentPage.every(l => selectedLoanIds.includes(l._id));

  return (
    <div className="app-container">
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-brand">
          Asset<span>Lending</span>
        </div>
        {user && (
          <div className="nav-links">
            {user.role === 'librarian' && (
              <button 
                className={`nav-item ${activeTab === 'dashboard-view' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard-view'); fetchDashboardStats(); }}
              >
                Dashboard
              </button>
            )}

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

            {/* TAB: DASHBOARD (Goal 8 - Librarian only) */}
            {activeTab === 'dashboard-view' && user.role === 'librarian' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2>Library Operations Dashboard</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Operational overview, active asset circulation, custodian distribution, and 8-week return trends.
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={fetchDashboardStats}>
                    ↻ Refresh Stats
                  </button>
                </div>

                {loadingDashboard && !dashboardStats ? (
                  <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard metrics...</p>
                ) : dashboardStats ? (
                  <div>
                    {/* Headline Numbers Grid */}
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-title">Items Currently Out</div>
                        <div className="stat-value" style={{ color: '#f59e0b' }}>
                          {dashboardStats.headlines.itemsOut}
                        </div>
                        <div className="stat-desc">Active borrower checkouts</div>
                      </div>

                      <div className="stat-card" style={dashboardStats.headlines.itemsOverdue > 0 ? { borderColor: '#ef4444' } : {}}>
                        <div className="stat-title">Items Overdue</div>
                        <div className="stat-value" style={{ color: '#ef4444' }}>
                          {dashboardStats.headlines.itemsOverdue}
                        </div>
                        <div className="stat-desc">Due date passed and not yet returned</div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-title">Returned This Week</div>
                        <div className="stat-value" style={{ color: '#10b981' }}>
                          {dashboardStats.headlines.loansReturnedThisWeek}
                        </div>
                        <div className="stat-desc">Loans returned in last 7 days</div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-title">Total Catalogue Items</div>
                        <div className="stat-value" style={{ color: '#6366f1' }}>
                          {dashboardStats.headlines.totalCatalogueItems}
                        </div>
                        <div className="stat-desc">Total assets tracked in library</div>
                      </div>
                    </div>

                    {/* Chart & Breakdowns Layout */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                      {/* Weekly Returns Chart */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="card-header" style={{ marginBottom: '1rem' }}>
                          <h3 className="card-title">Items Returned per Week (Last 8 Weeks)</h3>
                          <span className="card-subtitle">Aggregated return volume</span>
                        </div>
                        <div style={{ height: '260px', width: '100%', position: 'relative' }}>
                          <canvas ref={chartCanvasRef}></canvas>
                        </div>
                      </div>

                      {/* Status Breakdown Card */}
                      <div className="card">
                        <div className="card-header" style={{ marginBottom: '1rem' }}>
                          <h3 className="card-title">Loans by Lifecycle Status</h3>
                          <span className="card-subtitle">Distribution across all historical records</span>
                        </div>
                        <div className="status-breakdown-grid">
                          <div className="status-pill-card">
                            <span className="badge badge-requested">Requested</span>
                            <span className="status-count">{dashboardStats.statusBreakdown.Requested}</span>
                          </div>
                          <div className="status-pill-card">
                            <span className="badge badge-issued">Issued</span>
                            <span className="status-count">{dashboardStats.statusBreakdown.Issued}</span>
                          </div>
                          <div className="status-pill-card">
                            <span className="badge badge-returned">Returned</span>
                            <span className="status-count">{dashboardStats.statusBreakdown.Returned}</span>
                          </div>
                          <div className="status-pill-card">
                            <span className="badge badge-lost">Lost</span>
                            <span className="status-count">{dashboardStats.statusBreakdown.Lost}</span>
                          </div>
                        </div>

                        {/* Quick Action links */}
                        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('catalogue')}>
                            Manage Catalogue
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('loans')}>
                            View Loans List
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={handleExportActiveLoans}>
                            Export Active Loans CSV
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown by Custodian */}
                    <div className="card">
                      <div className="card-header" style={{ marginBottom: '1rem' }}>
                        <h3 className="card-title">Librarian Custodian Breakdown</h3>
                        <span className="card-subtitle">Catalogue assets and active loans monitored per librarian</span>
                      </div>
                      
                      {dashboardStats.custodianBreakdown.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No librarians registered.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Librarian</th>
                                <th>Assets Custodianed</th>
                                <th>Active Checkouts On Custodianed Assets</th>
                                <th>Total Historical Loans</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dashboardStats.custodianBreakdown.map(c => (
                                <tr key={c.librarianId}>
                                  <td>
                                    <strong>{c.username}</strong>
                                    {c.username === user.username && (
                                      <span className="user-role-badge" style={{ marginLeft: '0.5rem' }}>You</span>
                                    )}
                                  </td>
                                  <td>{c.itemCount} items</td>
                                  <td>
                                    <span className="badge badge-borrowed">{c.activeLoansCount} active</span>
                                  </td>
                                  <td>{c.totalLoansCount} loans</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>Failed to load dashboard.</p>
                )}
              </div>
            )}

            {/* TAB: CATALOGUE */}
            {activeTab === 'catalogue' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2>Equipment Catalogue</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Browse available equipment, check custodian coverage, and request items.
                    </p>
                  </div>

                  {user.role === 'librarian' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveModal('bulkImport')}
                      >
                        📥 Bulk Import (CSV)
                      </button>
                    </div>
                  )}
                </div>
                
                {user.role === 'librarian' && (
                  <div className="filter-tabs">
                    <button 
                      className={`filter-tab ${!onlyMyCustodian ? 'active' : ''}`}
                      onClick={() => setOnlyMyCustodian(false)}
                    >
                      Full Catalogue ({items.length})
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
                      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No items found in catalogue.</p>
                      </div>
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
                      <h3 className="card-title">Add Single Asset</h3>
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

                      <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                          Need to import multiple items?
                        </span>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ width: '100%' }}
                          onClick={() => setActiveModal('bulkImport')}
                        >
                          Open CSV Bulk Importer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: LOANS */}
            {activeTab === 'loans' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2>{user.role === 'librarian' ? 'System Checkout History & Requests' : 'My Requests & Loans'}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Server-side searched, filtered, and paginated loan records.
                    </p>
                  </div>

                  {user.role === 'librarian' && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedLoanIds.length > 0 && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setActiveModal('bulkReturn')}
                        >
                          ↩ Bulk Return ({selectedLoanIds.length})
                        </button>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={handleExportActiveLoans}
                      >
                        📤 Export Active Loans (CSV)
                      </button>
                    </div>
                  )}
                </div>

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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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

                      {user.role === 'librarian' && issuedLoansOnCurrentPage.length > 0 && (
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={handleSelectAllIssued}
                          style={{ marginLeft: '0.5rem' }}
                        >
                          {allCurrentPageIssuedSelected ? 'Deselect Page Issued' : 'Select All Page Issued'}
                        </button>
                      )}
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
                  {selectedLoanIds.length > 0 && (
                    <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>
                      ({selectedLoanIds.length} loan{selectedLoanIds.length > 1 ? 's' : ''} selected for bulk action)
                    </span>
                  )}
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
                      <div className="card" key={loan._id} style={selectedLoanIds.includes(loan._id) ? { borderColor: 'var(--accent-primary)', backgroundColor: '#1e2640' } : {}}>
                        <div className="card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {user.role === 'librarian' && loan.status === 'Issued' && (
                              <input 
                                type="checkbox"
                                checked={selectedLoanIds.includes(loan._id)}
                                onChange={() => handleToggleSelectLoan(loan._id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                title="Select for bulk return"
                              />
                            )}
                            <div>
                              <h3 className="card-title">{loan.item?.name || 'Unknown Item'}</h3>
                              <span className="card-subtitle">
                                Borrower: {loan.borrower?.username} | Category: {loan.item?.category}
                              </span>
                            </div>
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
        Smart Lending System © 2026. Plain CSS implementation.
      </footer>

      {/* ================= MODALS ================= */}

      {/* MODAL: CSV BULK IMPORT (Goal 7) */}
      {activeModal === 'bulkImport' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Import Catalogue Items (CSV)</h3>
              <button className="nav-item" onClick={() => setActiveModal(null)} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <form onSubmit={handleCsvBulkImportSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Upload a <code>.csv</code> file or paste CSV text below. First line must be a header row containing <code>Name</code> and <code>Category</code> columns.
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input 
                    type="file" 
                    accept=".csv,text/csv,text/plain"
                    onChange={handleCsvFileUpload}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={loadSampleCsvTemplate}
                  >
                    Load Sample CSV
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">CSV Data</label>
                  <textarea 
                    className="form-control"
                    rows="8"
                    placeholder="Name,Category&#10;Sony FX3 Camera,Cameras&#10;Shure SM7B Mic,Audio"
                    value={csvInputText}
                    onChange={(e) => setCsvInputText(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={importingCsv}>
                  {importingCsv ? 'Importing...' : 'Import Catalogue Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV IMPORT REPORT (Per-row report) */}
      {activeModal === 'csvImportReport' && csvImportReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h3 className="modal-title">CSV Bulk Import Report</h3>
              <button className="nav-item" onClick={() => { setActiveModal(null); setCsvImportReport(null); }} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem' }}>
                  <div className="stat-title">Total Rows</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{csvImportReport.totalRows}</div>
                </div>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem', borderColor: '#10b981' }}>
                  <div className="stat-title">Successfully Imported</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: '#10b981' }}>{csvImportReport.importedCount}</div>
                </div>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem', borderColor: csvImportReport.failedCount > 0 ? '#ef4444' : 'var(--border-color)' }}>
                  <div className="stat-title">Failed Rows</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: csvImportReport.failedCount > 0 ? '#ef4444' : '#94a3b8' }}>{csvImportReport.failedCount}</div>
                </div>
              </div>

              {csvImportReport.failed.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    Failed Rows Breakdown ({csvImportReport.failed.length})
                  </h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Raw Content</th>
                          <th>Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvImportReport.failed.map((f, i) => (
                          <tr key={i}>
                            <td><strong>Row {f.row}</strong></td>
                            <td><code>{f.raw}</code></td>
                            <td style={{ color: '#ef4444' }}>{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {csvImportReport.imported.length > 0 && (
                <div>
                  <h4 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                    Imported Items ({csvImportReport.imported.length})
                  </h4>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Row #</th>
                          <th>Asset Name</th>
                          <th>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvImportReport.imported.map((item, i) => (
                          <tr key={i}>
                            <td>Row {item.row}</td>
                            <td><strong>{item.item.name}</strong></td>
                            <td>{item.item.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); setCsvImportReport(null); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK RETURN CONFIRMATION (Goal 7) */}
      {activeModal === 'bulkReturn' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Return Loans</h3>
              <button className="nav-item" onClick={() => setActiveModal(null)} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <form onSubmit={handleBulkReturnSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  You have selected <strong>{selectedLoanIds.length}</strong> issued loan(s) to process as returned.
                </p>

                <div className="form-group">
                  <label className="form-label">Bulk Return Note (optional)</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    placeholder="e.g. End of term equipment check-in batch..."
                    value={bulkReturnNote}
                    onChange={(e) => setBulkReturnNote(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Process Return ({selectedLoanIds.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK RETURN REPORT (Goal 7 - Per loan result report) */}
      {activeModal === 'bulkReturnReport' && bulkReturnReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Return Processing Report</h3>
              <button className="nav-item" onClick={() => { setActiveModal(null); setBulkReturnReport(null); }} style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem' }}>
                  <div className="stat-title">Total Processed</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{bulkReturnReport.total}</div>
                </div>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem', borderColor: '#10b981' }}>
                  <div className="stat-title">Successful Returns</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: '#10b981' }}>{bulkReturnReport.successCount}</div>
                </div>
                <div className="stat-card" style={{ flex: 1, padding: '0.75rem', borderColor: bulkReturnReport.rejectedCount > 0 ? '#ef4444' : 'var(--border-color)' }}>
                  <div className="stat-title">Rejected / Skipped</div>
                  <div className="stat-value" style={{ fontSize: '1.4rem', color: bulkReturnReport.rejectedCount > 0 ? '#ef4444' : '#94a3b8' }}>{bulkReturnReport.rejectedCount}</div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Loan ID</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkReturnReport.results.map((r, i) => (
                      <tr key={i}>
                        <td><code>{r.loanId}</code></td>
                        <td>
                          <span className={`badge badge-${r.status === 'success' ? 'returned' : 'lost'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.message || r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); setBulkReturnReport(null); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
                {selectedTimeline.map((history) => (
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
