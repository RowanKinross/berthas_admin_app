import './customers.css';
import { useState, useEffect } from 'react';
import { app, db } from '../firebase/firebase';
import { getDocs, collection, doc, updateDoc, addDoc } from 'firebase/firestore'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

const Customers = ({ accountID }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [deliveryRegions, setDeliveryRegions] = useState([]);
  const [addCustomer, setAddCustomer] = useState(false);
  const [customerAddedMsg, setCustomerAddedMsg] = useState(false);
  
  // Add customer modal form states
  const [name, setName] = useState('');
  const [nameNumber, setNameNumber] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [currentRegion, setCurrentRegion] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  // Add pizza preference state
  const [pizzaPreference, setPizzaPreference] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch customers
        const customersSnapshot = await getDocs(collection(db, "customers"));
        const accountsData = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAccounts(accountsData);

        // Fetch regions
        const regionsSnapshot = await getDocs(collection(db, "regions"));
        const regionsData = regionsSnapshot.docs.map(doc => ({
          value: doc.id, // Use document ID as value
          label: doc.data().name || doc.id // Use 'name' field or fallback to ID
        }));
        setDeliveryRegions(regionsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
    if (e.target.value === '') {
      setSelectedCustomerId('');
    }
  };

  const handleCustomerSelect = (customer) => {
    if (customer === 'ADD_NEW') {
      setAddCustomer(true);
      setShowDropdown(false);
      setSearchTerm('');
      return;
    }
    
    setSelectedCustomerId(customer.id);
    setSearchTerm(customer.customer);
    setShowDropdown(false);
    setEditing(null);
  };

  const filteredCustomers = accounts.filter(account =>
    account.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.account_ID.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (account) => {
    // Find the region ID that matches the stored region name
    const regionMatch = deliveryRegions.find(region => region.label === account.delivery_region);
    const regionValue = regionMatch ? regionMatch.value : "";

    setEditing(account.id);
    setFormValues({
      account_ID: account.account_ID,
      customer: account.customer,
      name_number: account.name_number,
      street: account.street,
      city: account.city,
      postcode: account.postcode,
      delivery_region: regionValue, // Use the region ID for the dropdown
      phone_number: account.phone_number,
      email: account.email,
      default_pizza_view: account.default_pizza_view || "",
    });
  };

  const handleChange = (e) => {
    setFormValues({
      ...formValues,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveClick = async (id) => {
    try {
      // Get the region name instead of the ID before saving
      const selectedRegion = deliveryRegions.find(region => region.value === formValues.delivery_region);
      const regionName = selectedRegion ? selectedRegion.label : formValues.delivery_region;

      const updatedValues = {
        account_ID: formValues.account_ID || "",
        customer: formValues.customer || "",
        name_number: formValues.name_number || "",
        street: formValues.street || "",
        city: formValues.city || "",
        postcode: formValues.postcode || "",
        delivery_region: regionName || "", // Save the region name, not the ID
        phone_number: formValues.phone_number || "",
        email: formValues.email || "",
        default_pizza_view: formValues.default_pizza_view || ""
      };

      const accountRef = doc(db, "customers", id);
      await updateDoc(accountRef, updatedValues);
      setEditing(null);
      setAccounts(accounts.map(account => account.id === id ? { ...account, ...updatedValues } : account));
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  };

  // Add the modal form change handler
  const handleModalChange = (e) => {
    const { name, value } = e.target;
    switch(name) {
      case 'name': setName(value); break;
      case 'nameNumber': setNameNumber(value); break;
      case 'street': setStreet(value); break;
      case 'city': setCity(value); break;
      case 'postcode': setPostcode(value); break;
      case 'phoneNumber': setPhoneNumber(value); break;
      case 'email': setEmail(value); break;
      default: break;
    }
  };

  // Add the generateAccountID function
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

  // Replace your existing handleAddNewCustomer function with this:
  const handleAddNewCustomer = async () => {
    try {
      const newAccountID = generateAccountID({ name, postcode });

      const newCustomerData = {
        account_ID: newAccountID,
        customer: name,
        name_number: nameNumber,
        street: street,
        city: city,
        postcode: postcode,
        email: email,
        phone_number: phoneNumber,
        delivery_region: currentRegion,
        default_pizza_view: pizzaPreference, // Add pizza preference
        created_at: new Date().toISOString()
      };

      // Add the new customer to Firestore
      const docRef = await addDoc(collection(db, "customers"), newCustomerData);
      
      // Update local state to include the new customer
      const newCustomer = {
        id: docRef.id,
        ...newCustomerData
      };
      setAccounts([...accounts, newCustomer]);

      // Auto-select the new customer
      setSelectedCustomerId(docRef.id);
      setSearchTerm(name);

      // Show success message
      setCustomerAddedMsg(true);
      setTimeout(() => setCustomerAddedMsg(false), 3000);

      // Clear form
      clearModalForm();

      console.log("Customer added with ID: ", newAccountID);
      
    } catch (error) {
      console.error("Error adding customer: ", error);
      setFormError("Error adding customer. Please try again.");
    }
  };

  // Add a helper function to clear the modal form
  const clearModalForm = () => {
    setName('');
    setNameNumber('');
    setStreet('');
    setCity('');
    setPostcode('');
    setCurrentRegion('');
    setPhoneNumber('');
    setEmail('');
    setPizzaPreference(''); // Clear pizza preference
    setFormError('');
  };

  const selectedCustomer = accounts.find(account => account.id === selectedCustomerId);

  return (
    <div className='account navContent'>
      <h2>CUSTOMERS</h2>
      
      {/* Customer Selection with Search */}
      <div className='entries'>
        <label>Customer:</label>
        <div className="customerSearchContainer" style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search customers"
            className="customerSelect"
          />
          <button 
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              position: 'absolute',
              right: '5px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ▼
          </button>
          {showDropdown && (
            <div className="customer-dropdown" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderTop: 'none',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000
            }}>
              
              {/* Existing customers */}
              {filteredCustomers.map(account => (
                <div
                  key={account.id}
                  onClick={() => handleCustomerSelect(account)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                >
                  {account.customer}
                </div>
              ))}
              {/* Add New Customer option */}
              <div
                onClick={() => handleCustomerSelect('ADD_NEW')}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                  backgroundColor: '#f0f8ff',
                  fontWeight: 'bold',
                  color: '#007bff'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e6f3ff'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f0f8ff'}
              >
                + Add New Customer
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}

      {/* Display selected customer details */}
      {selectedCustomer && (
        <div key={selectedCustomer.id}>
          {editing === selectedCustomer.id ? (
            <div>
              <div className='entries'>
                <label>Account ID:</label> {selectedCustomer.account_ID}
              </div>
              <div className='entries'>
                <label>Name:</label>
                <input
                  type="text"
                  name="customer"
                  value={formValues.customer}
                  onChange={handleChange}
                />
              </div>
              <div className='entries'>
                <label>Address:</label>
                <input
                  type="text"
                  name="name_number"
                  value={formValues.name_number}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="street"
                  value={formValues.street}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="city"
                  value={formValues.city}
                  onChange={handleChange}
                />
              </div>
              <div className='entries'>
                <label>Postcode:</label>
                <input
                  type="text"
                  name="postcode"
                  value={formValues.postcode}
                  onChange={handleChange}
                />
              </div>
              <div className='entries'>
                <label>Delivery Region:</label>
                <select
                  name="delivery_region"
                  value={formValues.delivery_region}
                  onChange={handleChange}
                >
                  <option value="">{formValues.delivery_region||'select region'}</option>
                  {deliveryRegions.map(region => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='entries'>
                <label>Phone Number:</label>
                <input
                  type="text"
                  name="phone_number"
                  value={formValues.phone_number}
                  onChange={handleChange}
                />
              </div>
              <div className='entries'>
                <label>Email:</label>
                <input
                  type="text"
                  name="email"
                  value={formValues.email}
                  onChange={handleChange}
                />
              </div>
              <div className='entries'>
                <label>Pizza Type:</label>
                <select
                  name="default_pizza_view"
                  value={formValues.default_pizza_view}
                  onChange={handleChange}
                >
                  <option value="withSleeve">With Sleeves</option>
                  <option value="withoutSleeve">Without Sleeves</option>
                  <option value="all">All Pizzas</option>
                </select>
              </div>
              <button className='saveButton button' onClick={() => handleSaveClick(selectedCustomer.id)}>Save</button>
            </div>
          ) : (
            <div>
              <div className='entries'>
                <label>Account ID:</label>
                <p> {selectedCustomer.account_ID} </p>
              </div>
              <div className='entries'>
                <label>Name:</label>
                <p> {selectedCustomer.customer} </p>
              </div>
              <div className='entries'>
                <label>Address:</label> 
                <p>{selectedCustomer.name_number}, {selectedCustomer.street} <br/>{selectedCustomer.city}</p>
              </div>
              <div className='entries'>
                <label>Postcode:</label> 
                <p>{selectedCustomer.postcode} </p>
              </div>
              <div className='entries'>
                <label>Delivery Region:</label> 
                <p>{selectedCustomer.delivery_region || 'No Region Set'}</p>
              </div>
              <div className='entries'>
                <label>Phone Number:</label> 
                <p>{selectedCustomer.phone_number}</p>
              </div>
              <div className='entries'>
                <label>Email:</label> 
                <p>{selectedCustomer.email} </p>
              </div>
              <div className='entries'>
                <label>Pizza Type:</label>
                <p>  {
                  {
                    withSleeve: 'With Sleeves',
                    withoutSleeve: 'Without Sleeves',
                    all: 'All Pizzas',
                  }[selectedCustomer.default_pizza_view] || 'No Preference'
                }</p>
              </div>
              <button className='editButton' onClick={() => handleEditClick(selectedCustomer)}><FontAwesomeIcon icon={faEdit} className='icon' /></button>
            </div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {addCustomer && (
        <div className='modal'>
          <div className='modalContent addCustomerModal'>
            <button className='closeButton' onClick={() => {
              setAddCustomer(false);
              clearModalForm();
            }}>×</button>
            {customerAddedMsg && (
              <div className='customerAdded'>
                ✅ Customer added!
              </div>
            )}
            <div>
              <label><h6>Name:</h6></label>
              <input
                type="text"
                placeholder=""
                name="name"
                value={name}
                onChange={handleModalChange}
              />

              <label><h6>Address:</h6></label>
              <input
                type="text"
                placeholder="First Line of Address"
                name="nameNumber"
                value={nameNumber}
                onChange={handleModalChange}
              />
              <input
                type="text"
                placeholder="Second Line of Address (optional)"
                name="street"
                value={street}
                onChange={handleModalChange}
              />
              <input
                type="text"
                placeholder="Town/City"
                name="city"
                value={city}
                onChange={handleModalChange}
              />
              <input
                type="text"
                placeholder="postcode"
                name="postcode"
                value={postcode}
                onChange={handleModalChange}
              />
            </div>
            
            <div>
              <label><h6>Delivery Region:</h6></label>
              <select
                value={currentRegion}
                onChange={(e) => setCurrentRegion(e.target.value)}
              >
                <option value="">Select Region</option>
                {deliveryRegions.map((region) => (
                  <option key={region.value} value={region.label}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>

            <label><h6>Phone Number:</h6></label>
            <input
              type="text"
              placeholder=""
              name="phoneNumber"
              value={phoneNumber}
              onChange={handleModalChange}
            />
            
            <label><h6>Email:</h6></label>
            <input
              type="text"
              placeholder=""
              name="email"
              value={email}
              onChange={handleModalChange}
            />

            <div>
              <label><h6>Pizza Type:</h6></label>
              <select
                value={pizzaPreference}
                onChange={(e) => setPizzaPreference(e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="withSleeve">With Sleeves</option>
                <option value="withoutSleeve">Without Sleeves</option>
                <option value="all">All Pizzas</option>
              </select>
            </div>
            
            {formError && <p style={{ color: 'red', fontSize: '0.9em' }}>{formError}</p>}
            
            <button 
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
            >Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;