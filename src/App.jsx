import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
//import { useState } from 'react'
import logo from './bertha_logo.png'
import './App.css'
import NavTabs from './components/navTabs/NavTabs'
import Home from './components/home/Home'
import NewOrder from './components/newOrder/NewOrder'
import OrderHistory from './components/orderHistory/OrderHistory'
import Orders from './components/orders/Orders'
import Inventory from './components/inventory/Inventory'
import DemandSummary from './components/demandSummary/demandSummary'

  
function App() {
  const [customerName, setCustomerName] = useState(null);





return (
  <>
      <Router>
      <header className='header'>
        <img src={logo} className="logo berthasLogo" alt="Bertha's Logo" />
          <NavTabs customerName={customerName} setCustomerName={setCustomerName}/>
      </header>
      <div className='body'>
        <div className='navContent'>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="newOrder" element={<NewOrder customerName={customerName}/>} />
            <Route path="orderHistory" element={<OrderHistory />} />
            <Route path="orders" element={<Orders />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="demandSummary" element={<DemandSummary />} />
          </Routes>
        </div>
      </div>
      </Router>
      {/* <Footer/> */}
  </>
  )
}

export default App
