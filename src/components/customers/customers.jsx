import './customers.css';
import { useState, useEffect } from 'react';
import { app, db } from '../firebase/firebase';
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

const Customers = ({ accountID }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [editing, setEditing] = useState(null);
  const [formValues, setFormValues] = useState({});

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "customers"));
        const accountsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAccounts(accountsData);
        
        // Auto-select first customer if available
        if (accountsData.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(accountsData[0].id);
        }
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchAccount();
  }, [selectedCustomerId]);

  const handleCustomerSelect = (e) => {
    setSelectedCustomerId(e.target.value);
    setEditing(null); // Exit edit mode when switching customers
  };

  const handleEditClick = (account) => {
    setEditing(account.id);
    setFormValues({
      account_ID: account.account_ID,
      customer: account.customer,
      name_number: account.name_number,
      street: account.street,
      city: account.city,
      postcode: account.postcode,
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
      const updatedValues = {
        account_ID: formValues.account_ID || "",
        customer: formValues.customer || "",
        name_number: formValues.name_number || "",
        street: formValues.street || "",
        city: formValues.city || "",
        postcode: formValues.postcode || "",
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
      
      {/* Customer Selection Dropdown */}
      <div className='entries'>
        <label>Customer:</label>
        <select 
          value={selectedCustomerId} 
          onChange={handleCustomerSelect}
          className="customerSelect"
        >
          <option value="">-- Select a Customer --</option>
          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.customer}
            </option>
          ))}
        </select>
      </div>

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