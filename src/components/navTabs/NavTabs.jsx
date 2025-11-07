import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import './navtabs.css';
import { app, db, auth, signInWithEmailAndPassword } from '../firebase/firebase';
import { signOut } from 'firebase/auth'; 
import { collection, query, where, getDocs, addDoc } from '@firebase/firestore';
import { Dropdown, Button, Form } from 'react-bootstrap';
import { nanoid } from 'nanoid';


function NavTabs() {
  // Add the navigate and location hooks
  const navigate = useNavigate();
  const location = useLocation();
  
  const [userRole, setUserRole] = useState(null); // Initially set to null (no user)
  const [dropdownOpen, setDropdownOpen] = useState(false); // dropdown menu visibility (admin or unit?)
  // login and password states
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null); // 'admin' | 'unit' | null

  const ROLE_EMAILS = {
    admin: 'admin@berthasapp.com',
    unit: 'unit@berthasapp.com',
  };

  const login = async (role, password) => {
    const email = ROLE_EMAILS[role];
    if (!email) throw new Error("Role not found");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setUserRole(role);
      localStorage.setItem("userRole", role);
    } catch (error) {
      throw new Error("Incorrect password");
    }
  };


  
  const handleLogOut = async () => {
    try {
      await signOut(auth);
      setUserRole(null); // Clear user role state
      localStorage.removeItem('userRole'); // Clear from localStorage
      navigate("/"); // Navigate to home
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }
  
  // Render navigation tabs based on user role
  const renderNavTabs = () => {
    if (!userRole) return null;

    if (userRole === "admin") {
      return (
        <>
          <NavLink to="/" />
          <NavLink to="/orders" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ORDERS</h3>
          </NavLink>
          <NavLink to="/newOrderAdmin" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">NEW ORDER</h3>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">CUSTOMERS</h3>
          </NavLink>
          <NavLink to="/summary" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">DEMAND SUMMARY</h3>
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">INVENTORY</h3>
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ARCHIVE</h3>
          </NavLink>          
          <NavLink to="/batchCodes" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">BATCHES</h3>
          </NavLink>
          {/* discontinued tab 
          <NavLink to="/prep" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">PREP</h3>
          </NavLink> */}
        </>
      );
    } else if (userRole === "unit") {
      return (
        <>
          {/* discontinued tab 
          <NavLink to="/prep" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">PREP</h3>
          </NavLink> */}
          <NavLink to="/batchCodes" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">BATCHES</h3>
          </NavLink>
        </>
      );
    } 
      return null;
  };


// Auto-navigate unit users to batchCodes
useEffect(() => {
  if (userRole === 'unit' && location.pathname === '/') {
    navigate('/batchCodes');
  }
}, [userRole, location.pathname, navigate]);

// Load user info from localStorage and auto-navigate if unit
useEffect(() => {
  const storedUserRole = localStorage.getItem('userRole');
  if (storedUserRole) {
    setUserRole(storedUserRole);
    // Auto-navigate unit users on page load/refresh
    if (storedUserRole === 'unit' && location.pathname === '/') {
      navigate('/batchCodes');
    }
  }
}, [location.pathname, navigate]);

// Update localStorage when userRole or customerName changes
useEffect(() => {
  if (userRole) {
    localStorage.setItem('userRole', userRole);
  } else {
    localStorage.removeItem('userRole');
  }
}, [userRole]);

// fetch delivery regions array
useEffect(() => {
  const fetchRegions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "regions"));
      const regionData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      const regions = regionData.map(region => region.name)
      setDeliveryRegions(regions)
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };
  fetchRegions();
}, []);



  return (
    <div className="navBarContainer">
      {/* Render navigation tabs based on user role */}
      {renderNavTabs()}
      {/* Render dropdown */}

      {userRole ? (
        <div className="loginContainer">
           <p className='loggedInStatement'>
            {userRole === "admin" ? "Admin Team" 
            : userRole === "unit" ? "Unit Team"
            : null}</p>
           {/* if userRole is unit, set the login statement to 'Unit Team', if */}
          <Button className='button' variant="outline-warning" onClick={() => {handleLogOut()}}>Logout</Button>
        </div>
        ) : (
        <>
        <Dropdown className='loginContainer' show={dropdownOpen} onToggle={(isOpen) => {
          setDropdownOpen(isOpen);
          if (!isOpen) {
            setActiveDropdown(null); // Collapse input on close
            setLoginPassword('');
            setLoginError('');
          }
        }}>
          <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
            Login
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {/* Unit Team */}
            <Dropdown.Item
              as="div"
              onClick={(e) => {
                e.stopPropagation(); // prevent dropdown from closing
                setActiveDropdown(activeDropdown === 'unit' ? null : 'unit');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div>Unit Team</div>
              {activeDropdown === 'unit' && (
                <div 
                  className="dropdown-login-box"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Form.Control
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setLoginPassword(value);

                      // Try login when password is at least 6 characters
                      if (value.length >= 6) {
                        try {
                          await login(activeDropdown, value);
                          setDropdownOpen(false);
                          setActiveDropdown(null);
                          setLoginPassword('');
                          setLoginError('');
                        } catch (err) {
                          setLoginError(err.message);
                        }
                      }
                    }}
                  />
                  {loginError && <p style={{ color: 'red', fontSize: '0.8em' }}>{loginError}</p>}
                </div>
              )}
            </Dropdown.Item>


  
            {/* Admin Team */}
            <Dropdown.Item
              as="div"
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(activeDropdown === 'admin' ? null : 'admin');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div>Admin Team</div>
              {activeDropdown === 'admin' && (
                <div 
                  className="dropdown-login-box"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Form.Control
                    type="password"
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setLoginPassword(value);

                      // Try login when password is at least 6 characters
                      if (value.length >= 6) {
                        try {
                          await login(activeDropdown, value);
                          setDropdownOpen(false);
                          setActiveDropdown(null);
                          setLoginPassword('');
                          setLoginError('');
                        } catch (err) {
                          setLoginError(err.message);
                        }
                      }
                    }}
                  />

                  {loginError && <p style={{ color: 'red', fontSize: '0.8em' }}>{loginError}</p>}
                </div>
              )}
            </Dropdown.Item>

          </Dropdown.Menu>
        </Dropdown>
        </>
      )}

      

      

  </div>
  );
}

export default NavTabs;