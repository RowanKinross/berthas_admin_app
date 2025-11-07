import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import logo from './bertha_logo.png'
import './App.css'
import NavTabs from './components/navTabs/NavTabs'
import Home from './components/home/Home'
import NewOrder from './components/newOrder/NewOrder'
import OrderHistory from './components/orderHistory/OrderHistory'
import Account from './components/account/account'
import Customers from './components/customers/customers'
import Orders from './components/orders/Orders'
import Inventory from './components/inventory/Inventory'
import Archive from './components/archive/Archive'
import Summary from './components/summary/Summary'
import BatchCodes from './components/batchCodes/BatchCodes'
import Prep from './components/prep/Prep'
import Auth from './components/auth/Auth';
import NewOrderAdmin from './components/newOrderAdmin/NewOrderAdmin';


function App() {
  const [customerName, setCustomerName] = useState(null);
  const [accountID, setAccountID] = useState(null);



return (
  <>
      <div className="App">
      </div>
      <Router>
      <header className='header'>
        <img src={logo} className="logo berthasLogo" alt="Bertha's Logo" />
          <NavTabs customerName={customerName} setCustomerName={setCustomerName} accountID={accountID} setAccountID={setAccountID}/>
      </header>
      <div className='body'>
        <div >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="newOrder" element={<NewOrder customerName={customerName} accountID={accountID}/>} />
            <Route path="orderHistory" element={<OrderHistory customerName={customerName} accountID={accountID}/>} />
            <Route path="account" element={<Account customerName={customerName} accountID={accountID}/>} />
            <Route path="customers" element={<Customers customerName={customerName} accountID={accountID}/>} />
            <Route path="orders" element={<Orders />} />
            <Route path="newOrderAdmin" element={<NewOrderAdmin/>} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="archive" element={<Archive />} />
            <Route path="summary" element={<Summary/>}/>
            <Route path="batchCodes" element={<BatchCodes/>}/>
            <Route path="prep" element={<Prep/>}/>
          </Routes>
        </div>
      </div>
      </Router>
      {/* <Footer/> */}
  </>
  )
}

export default App
