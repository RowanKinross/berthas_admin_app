import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './navtabs.css';
import { Dropdown, Button } from 'react-bootstrap';

function NavTabs() {
  const [userRole, setUserRole] = useState(null); // Initially set to null
  const [dropdownOpen, setDropdownOpen] = useState(false); // State to track dropdown menu visibility

  // Function to set the user role
  const setUser = (role) => {
    setUserRole(role === userRole ? null : role);
    setDropdownOpen(false)
    if (!role) {
      // Navigate to the home route after logout
      window.location.href = '/';
    }
  };

  // Render navigation tabs based on user role
  const renderNavTabs = () => {
    if (userRole === 'staff') {
      return (
        <>
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
    } else if (userRole === 'customer') {
      return (
        <>
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
        <NavLink to="/" >
          <h2 className="navTab"></h2>
        </NavLink>
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
          <p className='loggedInStatement '>Bertha's {userRole}</p>
          <Button className='loginButton' variant="outline-warning" onClick={() => { setUser(null); }}>Logout</Button>
        </div>
      ) : (
        <>
        <Dropdown className='loginContainer' show={dropdownOpen} onToggle={(isOpen) => setDropdownOpen(isOpen)}>
          <Dropdown.Toggle className='loginButton' variant="outline-warning" id="dropdown-basic">
            Login
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => setUser('customer')}> Customer Login </Dropdown.Item>
            <Dropdown.Item onClick={() => setUser('staff')}> Staff Login</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        </>
      )}

  </div>
  );
}

export default NavTabs;