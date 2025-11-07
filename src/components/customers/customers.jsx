import './customers.css';
import { useState, useEffect } from 'react';
import { app, db } from '../firebase/firebase';
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'; 
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
          {showDropdown && filteredCustomers.length > 0 && (
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
    </div>
  );
}

export default Customers;