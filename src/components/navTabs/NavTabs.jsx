import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate} from 'react-router-dom';
import './navtabs.css';
import { app, db } from '../firebase/firebase';
import { collection, query, where, getDocs, addDoc } from '@firebase/firestore';
import { Dropdown, Button, Form } from 'react-bootstrap';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';


function NavTabs({ customerName, setCustomerName, accountID, setAccountID }) {
  const [userRole, setUserRole] = useState(null); // Initially set to null (no user)
  const [dropdownOpen, setDropdownOpen] = useState(false); // dropdown menu visibility (staff or customer?)
  const [modalVisible, setModalVisible] = useState(false); // modal menu visibility (customer select or new customer)
  const [customerSearch, setCustomerSearch] = useState("");;
  const [customersData, setCustomersData] = useState([]);
  const [addCustomer, setAddCustomer] = useState(false); // set add customer to true to view the new customer form


  // form values
  const [name, setName] = useState("");
  const [nameNumber, setNameNumber] = useState("")
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentRegion, setCurrentRegion] = useState("")
  const [formError, setFormError] = useState('');

  const [deliveryRegions, setDeliveryRegions] = useState([])
  const [newRegion, setNewRegion] = useState("");
  const [addDeliveryRegion, setAddDeliveryRegion] = useState(false)
  const [addRegion, setAddRegion] = useState(false)
  const [customerAddedMsg, setCustomerAddedMsg] = useState(false);

  const toggleAddRegion = () => {
    setAddRegion(!addRegion);
  };

  // login and password states
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null); // 'admin' | 'unit' | null

  const login = async (username, password) => {
  const q = query(collection(db, "users"), where("user", "==", username));
  const snapshot = await getDocs(q);

  if (snapshot.empty) throw new Error("User not found");

  const userData = snapshot.docs[0].data();
  const isPasswordCorrect = await bcrypt.compare(password, userData.passwordHash);

  if (!isPasswordCorrect) throw new Error("Incorrect password");

  setUserRole(userData.role);
  localStorage.setItem("userRole", userData.role);
};

  const handleAddRegion = async () => {
    const region = newRegion.trim();
    if (!region) return;

    try {
      await addDoc(collection(db, "regions"), { name: region });
      setDeliveryRegions((prev) => [...prev, region]); 
      setCurrentRegion(region);                        
      setNewRegion("");                                
      setAddRegion(false);                             
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };
  
  let navigate = useNavigate()
  
  // handle inputs changing function
  const handleChange = (event) => {
    const { name, value } = event.target;
    switch (name) {
        case "name":
            setName(value);
            break;
        case "nameNumber":
            setNameNumber(value);
            break;
        case "street":
            setStreet(value);
            break;
        case "city":
            setCity(value);
            break;
        case "postcode":
            setPostcode(value);
            break;
        case "email":
            setEmail(value);
            break;
        case "phoneNumber":
            setPhoneNumber(value);
            break;
        case "deliveryRegion":
            setAddDeliveryRegion(true)
            setCurrentRegion(value);
            break;
        default:
            break;
    }
  }


  
  // function to get the customer data from firebase
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        const customersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCustomersData(customersData)
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchCustomers();
  }, []);

// reset form on modal open & close
  useEffect(() => {
  if (addCustomer) {
    resetCustomerForm(); // clear fields every time modal opens
  }
}, [addCustomer]);
const resetCustomerForm = () => {
  setName("");
  setNameNumber("");
  setStreet("");
  setCity("");
  setPostcode("");
  setPhoneNumber("");
  setEmail("");
  setCurrentRegion("");
  setNewRegion("");
  setCustomerSearch("");
};

  
const generateAccountID = ({ name, postcode }) => {
  const cleanedTitle = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const cleanedPostcode = (postcode || '')
    .replace(/\s+/g, '')
    .slice(-4)
    .toUpperCase();

  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase(); // Short 4-char ID

  return `${cleanedTitle}${cleanedPostcode}${shortId}`;
};
  
  
  //function to add customer data to firebase
  const handleAddNewCustomer = async () => {

    try {
      const newAccountID = generateAccountID({name, postcode});
      setAccountID(newAccountID);
      setCustomerName(name);
      handleAddRegion()


      const docRef = await addDoc(collection(db, "customers"), {
        account_ID: newAccountID,
        customer: name,
        name_number: nameNumber,
        street: street,
        city: city,
        postcode: postcode,
        email: email,
        phone_number: phoneNumber,
        delivery_region: currentRegion
      });
      
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }
  
  const handleLogOut = () => {
    setUserRole(null); 
    setCustomerName(null);
    setAccountID(null)
    setModalVisible(false)

    localStorage.removeItem('customerName');
    localStorage.removeItem('accountID');
    localStorage.removeItem('userRole');

    navigate("/");
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
          <NavLink to="/inventory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">INVENTORY</h3>
          </NavLink>
          <NavLink to="/summary" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">DEMAND SUMMARY</h3>
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ARCHIVE</h3>
          </NavLink>          
          <NavLink to="/batchCodes" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">BATCH CODES</h3>
          </NavLink>
          <NavLink to="/prep" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">PREP</h3>
          </NavLink>
        </>
      );
    } else if (userRole === "unit") {
      return (
        <>
          <NavLink to="/prep" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">PREP</h3>
          </NavLink>
          <NavLink to="/batchCodes" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">BATCH CODES</h3>
          </NavLink>
        </>
      );
    } else if (userRole === "customers") {
      return (
        <>
          <NavLink to="/" />
         <NavLink to="/newOrder" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">NEW ORDER</h3>
          </NavLink>
           <NavLink to="/orderHistory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ORDER HISTORY</h3>
          </NavLink>
          <NavLink to="/account" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ACCOUNT INFO</h3>
          </NavLink>
        </>
      );
    } 
      return null;
  };


// Load user info from localStorage
useEffect(() => {
  const storedUserRole = localStorage.getItem('userRole');
  const storedCustomerName = localStorage.getItem('customerName');
  const storedAccountID = localStorage.getItem('accountID');
  if (storedUserRole) setUserRole(storedUserRole);
  if (storedCustomerName) setCustomerName(storedCustomerName);
  if (storedAccountID) setAccountID(storedAccountID);
}, []);

// Update localStorage when userRole or customerName changes
useEffect(() => {
  if (userRole) {
    localStorage.setItem('userRole', userRole);
  } else {
    localStorage.removeItem('userRole');
  }
  if (customerName) {
    localStorage.setItem('customerName', customerName);
  } else {
    localStorage.removeItem('customerName');
  }
  if (accountID) {
    localStorage.setItem('accountID', accountID);
  } else {
    localStorage.removeItem('accountID');
  }
}, [userRole, customerName, accountID]);

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
            {userRole === "customers" ? customerName
            : userRole === "admin" ? "Admin Team" 
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

                      if (value.length === 4) {
                        try {
                          await login(activeDropdown, value); // or "unit", "customers" based on dropdown
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

                      if (value.length === 4) {
                        try {
                          await login(activeDropdown, value); // or "unit", "customers" based on dropdown
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




            {/* Customers */}
            <Dropdown.Item
              as="div"
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(activeDropdown === 'customers' ? null : 'customers');
              }}
              style={{ cursor: 'pointer' }}
            >
              <div>Customers</div>
              {activeDropdown === 'customers' && (
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

                      if (value.length === 4) {
                        try {
                          await login(activeDropdown, value); // or "unit", "customers" based on dropdown
                          setDropdownOpen(false);
                          setActiveDropdown(null);
                          setLoginPassword('');
                          setLoginError('');
                          setModalVisible(true);
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

      {modalVisible && (
        <div className='modal'>
          <div className='modalContent'>
            <button className='closeButton' onClick={() => {handleLogOut()}}>×</button>
            <h3>Customer Login</h3>
            <div className='selectAdd'>
              <Dropdown>
              <Dropdown.Toggle className='button selectCustomerButton' variant="outline-warning" id="dropdown-basic">
                Select Customer
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Form.Control
                  type="text"
                  placeholder="Search Customers"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mx-3 my-2 w-auto"
                />
                <div className='customersScroll'>
                  {customersData
                    .filter((customer) =>
                      customer.customer.toLowerCase().includes(customerSearch.toLowerCase()) &&
                      !customer.account_ID.startsWith("SAMPLES")
                    )
                    .map((customer, index) => (
                      <Dropdown.Item
                        key={index}
                        onClick={() => {
                          setCustomerName(customer.customer);
                          setAccountID(customer.account_ID);
                          setModalVisible(false);
                        }}
                      >
                        {customer.customer}
                      </Dropdown.Item>
                    ))}
                  </div>
              </Dropdown.Menu>
            </Dropdown>
            <button className='button' onClick={() => {setAddCustomer(true); setModalVisible(false)}}>Add customer</button>
          </div>
          </div>
        </div>
      )}

      {addCustomer && (
        <div className='modal'>
        <div className='modalContent addCustomerModal'>
        <button className='closeButton' onClick={() => {setModalVisible(true); setAddCustomer(false)}}>×</button>
        {customerAddedMsg && (
          <div className='customerAdded'>
            ✅ Customer added!
          </div>
        )}
        <Form.Group>
          <Form.Label>
            <h6>Name:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder=""
            name="name"
            value={name}
            onChange={handleChange}
          />

          <Form.Label>
            <h6>Address:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder="First Line of Address"
            name="nameNumber"
            value={nameNumber}
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="Second Line of Address (optional)"
            name="street"
            value={street}
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="Town/City"
            name="city"
            value={city}
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="postcode"
            name="postcode"
            value={postcode}
            onChange={handleChange}
          />
        </Form.Group>
        <Dropdown>
            <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
              {currentRegion?  currentRegion : "Select Region"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {deliveryRegions.length >0? ( deliveryRegions.map((region, index) => (
                <Dropdown.Item key={index} onClick={() => {setCurrentRegion(region)}}>
                  {region}
                </Dropdown.Item>
              ))) :(
                <Dropdown.Item>
                Region List Loading...
                </Dropdown.Item>
              )}
              {addRegion ? (
                <Form.Control
                  type="text"
                  placeholder="Name of Region"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddRegion();
                    }
                  }}
                  autoFocus
                />
                ) : (
                <button type="button" className='button' onClick={toggleAddRegion}>
                    Add Region
                </button>
                )}
            </Dropdown.Menu>
          </Dropdown>
          <Form.Label>
            <h6>Phone Number:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder=""
            name="phoneNumber"
            value={phoneNumber}
            onChange={handleChange}
          />
          <Form.Label>
            <h6>Email:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder=""
            name="email"
            value={email}
            onChange={handleChange}
          />
        {formError && <p style={{ color: 'red', fontSize: '0.9em' }}>{formError}</p>}
        <Button 
          type="submit" 
          className='button' 
          onClick={() => {
            if (!name || !postcode) {
              setFormError('Please fill in both Name and Postcode.');
            } else {
              setFormError('');
              setAddCustomer(false);
              handleAddNewCustomer();
            }
          }}
        >Submit</Button>
        </div>
        </div>
      )}

  </div>
  );
}

export default NavTabs;