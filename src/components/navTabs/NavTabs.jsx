import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate} from 'react-router-dom';
import './navtabs.css';
import { app, db } from '../firebase/firebase';
import { collection, getDocs, addDoc } from '@firebase/firestore';
import { Dropdown, Button, Form } from 'react-bootstrap';
import { nanoid } from 'nanoid';


function NavTabs({ customerName, setCustomerName, accountID, setAccountID }) {
  const [userRole, setUserRole] = useState(null); // Initially set to null (no user)
  const [dropdownOpen, setDropdownOpen] = useState(false); // dropdown menu visibility (staff or customer?)
  const [modalVisible, setModalVisible] = useState(false); // modal menu visibility (customer select or new customer)
  const [customersArr, setCustomersArr] = useState([]);
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

  const [deliveryRegions, setDeliveryRegions] = useState([])
  const [addDeliveryRegion, setAddDeliveryRegion] = useState(false)
  const [addRegion, setAddRegion] = useState(false)

  const toggleAddRegion = () => {
    setAddRegion(!addRegion);
};

  const handleAddRegion = async (event) => {
    if (addDeliveryRegion) {
      event.preventDefault(); // Prevent the default form submission
      toggleAddRegion(); // Toggles the input box back to the button
      const region = event.target.value;
      setCurrentRegion(region);
      try {
        const docRef = await addDoc(collection(db, "regions"), {
          name: region
        });
        console.log("Document written with ID: ", docRef.id);
      } catch (e) {
        console.error("Error adding document: ", e);
      }
    }
  }
  

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


  
const generateAccountID = ({ name, postcode }) => {
  const cleanedTitle = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const cleanedPostcode = (postcode || '')
    .replace(/\s+/g, '')
    .slice(-4)
    .toUpperCase();

  const shortId = Math.random().toString(36).substring(2, 6).toUpperCase(); // Short 4-char ID

  console.log("Generating account ID from:", { name, postcode });

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
      
      console.log("Document written with ID: ", docRef.id);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }
  
  const handleLogOut = () => {
    setUserRole(null); 
    setCustomerName(null);
    setAccountID(null)

    localStorage.removeItem('customerName');
    localStorage.removeItem('accountID');
    localStorage.removeItem('userRole');

    navigate("/");
  }
  
  // Render navigation tabs based on user role
  const renderNavTabs = () => {
    if (userRole === "staff") {
      return (
        <>
          <NavLink to="/" />
          {/* <NavLink to="/orders" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ORDERS</h3>
          </NavLink> */}
          <NavLink to="/inventory" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">INVENTORY</h3>
          </NavLink>
          {/* <NavLink to="/demandSummary" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">DEMAND SUMMARY</h3>
          </NavLink> */}
          {/* <NavLink to="/archive" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">ARCHIVE</h3>
          </NavLink>           */}
          <NavLink to="/batchCodes" className={({ isActive }) =>
            isActive ? 'nav-link active' : 'nav-link'}>
            <h3 className="navTab">BATCH CODES</h3>
          </NavLink>
        </>
      );
    } else if (userRole === "customer") {
      return (
        <>
          {/* <NavLink to="/" />
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
          </NavLink> */}
        </>
      );
    } else {
      // If user role is not set or unknown, only render the Home tab
      return (
          <NavLink to="/"/>
      );
    }
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
           <p className='loggedInStatement'>{userRole === "customer" ? customerName : userRole === "staff" ? "Bertha's Staff" : null}</p>
           {/* if userRole is staff, set the login statement to 'Berha's Staff', if */}
          <Button className='button' variant="outline-warning" onClick={() => {handleLogOut()}}>Logout</Button>
        </div>
        ) : (
        <>
        <Dropdown className='loginContainer' show={dropdownOpen} onToggle={(isOpen) => setDropdownOpen(isOpen)}>
          <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
            Login
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => {setUserRole("customer"); setModalVisible(true)}}> Customer Login </Dropdown.Item>
            <Dropdown.Item onClick={() => setUserRole("staff")}> Staff Login</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        </>
      )}

      {modalVisible && (
        <div className='modal'>
          <div className='modalContent'>
            <button className='closeButton' onClick={() => {handleLogOut()}}>×</button>
            <h3>Customer Login</h3>
            <Dropdown>
            <Dropdown.Toggle className='button' variant="outline-warning" id="dropdown-basic">
              Select Customer
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {customersData.length >0? ( customersData.map((customer, index) => (
                <Dropdown.Item key={index} onClick={() => {setCustomerName(customer.customer); setAccountID(customer.account_ID); setModalVisible(false)}}>
                  {customer.customer}
                </Dropdown.Item>
              ))) :(
                <Dropdown.Item onClick={() => {setCustomerName(`customer`); setModalVisible(false)}}>
                Customer List Loading...
                </Dropdown.Item>
              )}
                <button className='button' onClick={() => {setAddCustomer(true); setModalVisible(false)}}>Add customer</button>
            </Dropdown.Menu>
          </Dropdown>
          </div>
        </div>
      )}

      {addCustomer && (
        <div className='modal'>
        <div className='modalContent'>
        <button className='closeButton' onClick={() => {setModalVisible(true); setAddCustomer(false)}}>×</button>
        <Form.Group>
          <Form.Label>
            <h6>Name:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder=""
            name="name"
            onChange={handleChange}
          />

          <Form.Label>
            <h6>Address:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder="First Line of Address"
            name="nameNumber"
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="Second Line of Address (optional)"
            name="street"
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="Town/City"
            name="city"
            onChange={handleChange}
          />
          <Form.Control
            type="text"
            placeholder="postcode"
            name="postcode"
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
                    name="deliveryRegion"
                    onChange={handleChange}
                    onBlur={toggleAddRegion}
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
            onChange={handleChange}
          />
          <Form.Label>
            <h6>Email:</h6>
          </Form.Label>
          <Form.Control
            type="text"
            placeholder=""
            name="email"
            onChange={handleChange}
          />
        <Button 
          type="submit" 
          className='button' 
          disabled={!name || !postcode}
          onClick={() => {setAddCustomer(false); handleAddNewCustomer()}}
        >Submit</Button>
        </div>
        </div>
      )}

  </div>
  );
}

export default NavTabs;