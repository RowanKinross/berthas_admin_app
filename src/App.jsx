import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { auth } from './components/firebase/firebase';
import logo from './bertha_logo.png'
import './App.css'
import NavTabs from './components/navTabs/NavTabs'
import Home from './components/home/Home'
import Customers from './components/customers/customers'
import Orders from './components/orders/Orders'
import Inventory from './components/inventory/Inventory'
import Archive from './components/archive/Archive'
import Summary from './components/summary/Summary'
import BatchCodes from './components/batchCodes/BatchCodes'
import NewOrderAdmin from './components/newOrderAdmin/NewOrderAdmin';

// Protected Route wrapper component
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      const userRole = localStorage.getItem('userRole');
      
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

  return children;
};

function App() {

  return (
    <>
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
