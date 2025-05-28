import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import logo from './bertha_logo.png'
import './App.css'
import NavTabs from './components/navTabs/NavTabs'
import Home from './components/home/Home'
import NewOrder from './components/newOrder/NewOrder'
import OrderHistory from './components/orderHistory/OrderHistory'
import Account from './components/account/account'
import Orders from './components/orders/Orders'
import Inventory from './components/inventory/Inventory'
import Archive from './components/archive/archive';
// import DemandSummary from './components/demandSummary/DemandSummary'
import BatchCodes from './components/batchCodes/BatchCodes'
import Auth from './components/auth/Auth';


function App() {
  const [customerName, setCustomerName] = useState(null);
  const [accountID, setAccountID] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showModal, setShowModal] = useState(false);



  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus !== 'true') {
      setShowModal(true);
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = (code) => {
    const correctCode = import.meta.env.VITE_REACT_APP_CORRECT_CODE;

    if (code === correctCode) {
      localStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);
      setShowModal(false);
    } else {
      alert('Incorrect Code');
    }
  };


return (
  <>
      <div className="App">
      {!isAuthenticated ? (
        <Auth showModal={showModal} handleAuth={handleAuth} />
      ): <></>}
      </div>
      <Router>
      <header className='header'>
        <img src={logo} className="logo berthasLogo" alt="Bertha's Logo" />
          <NavTabs customerName={customerName} setCustomerName={setCustomerName} accountID={accountID} setAccountID={setAccountID}/>
      </header>
      <div className='body'>
        <div className='navContent'>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="newOrder" element={<NewOrder customerName={customerName} accountID={accountID}/>} />
            <Route path="orderHistory" element={<OrderHistory customerName={customerName} accountID={accountID}/>} />
            <Route path="account" element={<Account customerName={customerName} accountID={accountID}/>} />
            <Route path="orders" element={<Orders />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="archive" element={<Archive />} />
            {/* <Route path="demandSummary" element={<DemandSummary />} /> */}
            <Route path="batchCodes" element={<BatchCodes/>}/>
          </Routes>
        </div>
      </div>
      </Router>
      {/* <Footer/> */}
  </>
  )
}

export default App
