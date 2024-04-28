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
// import Footer from './components/Footer'

function App() {

return (
  <>
      <Router>
      <header className='header'>
        <img src={logo} className="logo berthasLogo" alt="Bertha's Logo" />
          <NavTabs />
      </header>
      <div className='body'>
        <div className='navContent'>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="newOrder" element={<NewOrder />} />
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
