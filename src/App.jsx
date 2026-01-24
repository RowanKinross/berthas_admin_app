import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { auth } from './components/firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import logo from './bertha_logo.png'
import './App.css'
import NavTabs from './components/navTabs/NavTabs'
// import Prep from './components/prep/Prep'
import Home from './components/home/Home'
import Customers from './components/customers/customers'
import Orders from './components/orders/Orders'
import Inventory from './components/inventory/Inventory'
import Archive from './components/archive/Archive'
import Summary from './components/summary/Summary'
import BatchCodes from './components/batchCodes/BatchCodes'
import NewOrderAdmin from './components/newOrderAdmin/NewOrderAdmin';
import UpdateBanner from './components/UpdateBanner/UpdateBanner';
import useVersionCheck from './hooks/useVersionCheck';

// Protected Route wrapper component
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const navigate = useNavigate();
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const userRole = localStorage.getItem('userRole');
      
      if (!user && userRole) {
        // User was logged in but Firebase session expired
        localStorage.removeItem('userRole');
        setSessionExpired(true);
        
        // Show message for 3 seconds then redirect
        setTimeout(() => {
          setSessionExpired(false);
          navigate('/');
        }, 3000);
        return;
      }
      
      if (!user || !userRole) {
        navigate('/');
        return;
      }
      
      if (requiredRole && userRole !== requiredRole) {
        navigate('/');
        return;
      }
    });

    return () => unsubscribe();
  }, [navigate, requiredRole]);

  if (sessionExpired) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Session Expired</h3>
          <p>Your session has expired for security reasons. You will be redirected to the login page.</p>
          <div style={{ marginTop: '1rem', fontSize: '0.9em', color: '#666' }}>
            Redirecting in 3 seconds...
          </div>
        </div>
      </div>
    );
  }

  return children;
};

function App() {
  const { showUpdateBanner, refreshApp, dismissUpdate } = useVersionCheck();

  return (
    <>
      {showUpdateBanner && (
        <UpdateBanner onRefresh={refreshApp} onDismiss={dismissUpdate} />
      )}
      <div className="App">
      </div>
      <Router>
        <header className='header'>
          <img src={logo} className="logo berthasLogo" alt="Bertha's Logo" />
          <NavTabs/>
        </header>
        <div className='body'>
          <div>
            <Routes>
              <Route path="/" element={<Home />} />
              
              {/* Admin-only routes */}
              <Route path="customers" element={
                <ProtectedRoute requiredRole="admin">
                  <Customers/>
                </ProtectedRoute>
              } />
              <Route path="orders" element={
                <ProtectedRoute requiredRole="admin">
                  <Orders />
                </ProtectedRoute>
              } />
              <Route path="newOrderAdmin" element={
                <ProtectedRoute requiredRole="admin">
                  <NewOrderAdmin/>
                </ProtectedRoute>
              } />
              <Route path="inventory" element={
                <ProtectedRoute requiredRole="admin">
                  <Inventory />
                </ProtectedRoute>
              } />
              <Route path="archive" element={
                <ProtectedRoute requiredRole="admin">
                  <Archive />
                </ProtectedRoute>
              } />
              <Route path="summary" element={
                <ProtectedRoute requiredRole="admin">
                  <Summary/>
                </ProtectedRoute>
              } />
              {/* <Route path="prep" element={
                <ProtectedRoute requiredRole="admin">
                  <Prep/>
                </ProtectedRoute>
              } /> */}
              
              {/* Routes accessible by both roles */}
              <Route path="batchCodes" element={
                <ProtectedRoute>
                  <BatchCodes/>
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </div>
      </Router>
    </>
  )
}

export default App
