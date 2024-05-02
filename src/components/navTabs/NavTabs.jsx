import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './navtabs.css';
import { Dropdown, Modal, Button } from 'react-bootstrap';
import { render } from 'react-dom';
import NewOrder from '../newOrder/NewOrder';

function NavTabs({ customerName, setCustomerName }) {
  const [userRole, setUserRole] = useState(null); // Initially set to null (no user)
  const [dropdownOpen, setDropdownOpen] = useState(false); // dropdown menu visibility (staff or customer?)
  const [showModal, setShowModal] = useState(false); // modal menu visibility (customer select or new customer)
  
  const customers = ["Bertha's Pizza", "Touts", "Five Acre Farm"]


  // Function to set the user role
  const setUser = (role) => {
    setUserRole(role === userRole ? null : role); // if role is equal to the user role, set it to null (to toggle login and logout)
    setDropdownOpen(false)
    if (!role) {
      window.location.href = '/'; // Navigate to the home route after logout
    }
  };

  const handleUserSelection = (selectedUser) => {
    setCustomerName(selectedUser); // Set the selected customer's name
    setUserRole('customer'); // Set the user role to 'customer'
    setShowModal(false); // Close the modal

  }




  // Render navigation tabs based on user role
  const renderNavTabs = () => {
    if (userRole === "Bertha's staff") {
      return (
        <>
          <NavLink to="/" />
          <NavLink to="/orders" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h2 className="navTab">Orders</h2>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h2 className="navTab">Inventory</h2>
          </NavLink>
          <NavLink to="/demandSummary" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h2 className="navTab">Demand Summary</h2>
          </NavLink>
        </>
      );
    } else if (userRole === "customer") {
      return (
        <>
          <NavLink to="/" />
          <NavLink to="/newOrder" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h2 className="navTab">New Order</h2>
          </NavLink>
          <NavLink to="/orderHistory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h2 className="navTab">Order History</h2>
          </NavLink>
        </>
      );
    } else {
      // If user role is not set or unknown, only render the Home tab
      return (
        <NavLink to="/" />
      );
    }
  };

  return (
  <div className="navBarContainer">
      {/* Render navigation tabs based on user role */}
      {renderNavTabs()}
      {/* Render dropdown */}

      {userRole ? (
        <div className="loginContainer">
           <p className='loggedInStatement'>{userRole === "Bertha's staff" ? "Bertha's Staff" : customerName || userRole}</p>
          <Button className='button' variant="outline-warning" onClick={() => { setUser(null); }}>Logout</Button>
        </div>
        ) : (
        <>
        <Dropdown className='loginContainer' show={dropdownOpen} onToggle={(isOpen) => setDropdownOpen(isOpen)}>
          <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
            Login
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => {setUserRole("customer"); setShowModal(true)}}> Customer Login </Dropdown.Item>
            <Dropdown.Item onClick={() => setUserRole("Bertha's staff")}> Staff Login</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        </>
      )}

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Customer Login</Modal.Title>
        </Modal.Header>
        <Modal.Body className='loginModal'>
          <Dropdown>
            <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
              Select Customer
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {customers.map((customer, index) => (
                <Dropdown.Item key={index} onClick={() => handleUserSelection(customer)}>
                  {customer}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </Modal.Body>
      </Modal>

  </div>
  );
}

export default NavTabs;