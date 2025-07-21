import './account.css';
import { useState, useEffect } from 'react';
import { app, db } from '../firebase/firebase';
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

const Account = ({ accountID }) => {
  const [accounts, setAccounts] = useState([]);
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
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };
    fetchAccount();
  }, []);

  const handleEditClick = (account) => {
    setEditing(account.id);
    setFormValues({
      account_ID: account.account_ID,
      customer: account.customer,
      name_number: account.name_number,
      street: account.street,
      city: account.city,
      postcode: account.postcode,
      phoneNumber: account.phoneNumber,
      email: account.email,
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
        phoneNumber: formValues.phoneNumber || "",
        email: formValues.email || ""
      };


      const accountRef = doc(db, "customers", id);
      await updateDoc(accountRef, updatedValues);
      setEditing(null);
      setAccounts(accounts.map(account => account.id === id ? { ...account, ...updatedValues } : account));
  } catch (error) {
    console.error("Error updating document: ", error);
  }
  };

  return (
<div className='account'>
      <h2>ACCOUNT INFORMATION</h2>
      {accounts
        .filter(account => account.account_ID === accountID)
        .map(account => (
          <div key={account.id}>
            {editing === account.id ? (
              <div>
                <div className='entries'>
                  <label>Account ID:</label> {account.account_ID}
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
                    name="phoneNumber"
                    value={formValues.phoneNumber}
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
                <button className='saveButton button' onClick={() => handleSaveClick(account.id)}>Save</button>
              </div>
            ) : (
              <div>
                <div className='entries'>
                  <label>Account ID:</label>
                  <p> {account.account_ID} </p>
                </div>
                <div className='entries'>
                  <label>Name:</label>
                  <p> {account.customer} </p>
                </div>
                <div className='entries'>
                  <label>Address:</label> 
                  <p>{account.name_number}, {account.street} <br/>{account.city}</p>
                </div>
                <div className='entries'>
                  <label>Postcode:</label> 
                  <p>{account.postcode} </p>
                </div>
                <div className='entries'>
                  <label>Phone Number:</label> 
                  <p>{account.phone_number}</p>
                </div>
                <div className='entries'>
                  <label>Email:</label> 
                  <p>{account.email} </p>
                </div>
                <button className='editButton' onClick={() => handleEditClick(account)}><FontAwesomeIcon icon={faEdit} className='icon' /></button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

export default Account;