import './newOrderAdmin.css'
import { useState, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Dropdown from 'react-bootstrap/Dropdown';
import dayjs from 'dayjs';
import { app, db } from '../firebase/firebase';
import { addDoc, getDocs, collection, serverTimestamp, updateDoc, doc} from '@firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';


// Hook customer name and account ID
function  NewOrderAdmin({customerName, accountID}) {

const [pizzaQuantities, setPizzaQuantities] = useState({});
const [totalPizzas, setTotalPizzas] = useState(0)
const [additionalNotes, setAdditionalNotes] = useState("");
const [pizzaData, setPizzaData] = useState([]);
const [filterCriteria, setFilterCriteria] = useState("withSleeve");
const [customDeliveryWeek, setCustomDeliveryWeek] = useState("");
const [customerData, setCustomerData] = useState([]);
const [customerAddress, setCustomerAddress] = useState("");
const [customerEmail, setCustomerEmail] = useState("");
const [editableEmail, setEditableEmail] = useState("");
const [editingEmail, setEditingEmail] = useState(false);
const [stock, setStock] = useState([])
const [submitting, setSubmitting] = useState(false);
const [purchaseOrder, setPurchaseOrder] = useState('');
const [selectedCustomerId, setSelectedCustomerId] = useState(accountID || "");
const [customerSearch, setCustomerSearch] = useState("");
const [dropdownOpen, setDropdownOpen] = useState(false);
const [deliveryDay, setDeliveryDay] = useState("");
const [wastageReason, setWastageReason] = useState("");

const [sampleCustomerName, setSampleCustomerName] = useState("");
const [confirmChecked, setConfirmChecked] = useState(false);



const capitalizeWords = (str) => {
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};
const handleFilterChange = (event) => {
  setFilterCriteria(event.target.value);
};





// fetch stock data e.g what pizzas are in stock & their batches
const fetchStock = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'batches'));
    const data = querySnapshot.docs.map(doc => {
      const batchData = doc.data();
      const pizzasInBatch = batchData.pizzas.map((pizza) => ({
        batch_id: doc.id,
        batch_number: batchData.batch_code,
        pizza_id: pizza.id,
        quantity_available: pizza.quantity_available,
      }));
      return pizzasInBatch;
    });

    // Flatten the array of arrays (each batch's pizzas) into a single array
    const flattenedStock = data.flat();

    // Sort by batch_number
    flattenedStock.sort((a, b) => a.batch_number - b.batch_number);

    setStock(flattenedStock);
  } catch (error) {
    console.error("Error fetching stock data:", error);
  }
};

// function to get the customer data from firebase
const fetchCustomers = async () => {
   try {
     const querySnapshot = await getDocs(collection(db, "customers"));
     const fetchedCustomerData = querySnapshot.docs.map(doc => ({
       id: doc.id,
       ...doc.data()
      }));
      setCustomerData(fetchedCustomerData);
    } catch (error) {
      console.error("Error fetching customer data:", error);
    }
  };
 

// function to get the pizza data from firebase
const fetchPizzas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "pizzas"));
      const fetchedPizzaData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedPizzaData.sort((a, b) => {
       if (a.sleeve === b.sleeve) {
         return a.id.localeCompare(b.id);
       }
       return a.sleeve ? -1 : 1;
     });
      setPizzaData(fetchedPizzaData);
    } catch (error) {
      console.error("Error fetching pizzas:", error);
    }
  };



useEffect(() => {
  fetchStock();
  fetchCustomers();
  fetchPizzas();
  }, []);



useEffect(() => {
  if (customerData && selectedCustomerId) {
    const customer = customerData.find(c => c.account_ID === selectedCustomerId);
    if (customer) {
      setCustomerAddress(`${customer.name_number} ${customer.street}, ${customer.city}, ${customer.postcode}`);
      setEditableEmail(customer.email);
      setFilterCriteria(customer.default_pizza_view || "withSleeve");
    } else {
      setCustomerAddress("");
      setEditableEmail("");
      setFilterCriteria("withSleeve");
    }
  }
}, [selectedCustomerId, customerData]);




  useEffect(() => {
    // Initialize pizzaQuantities based on pizzaData
    const initialQuantities = pizzaData.reduce((acc, pizza) => {
      acc[pizza.id] = 0;
      return acc;
    }, {});
    setPizzaQuantities(initialQuantities);
  }, [pizzaData]);


const handleChange = (event) => {
  const { name, value } = event.target;
  if (name === "additionalNotes") {
    setAdditionalNotes(value);
  } else {
    setPizzaQuantities(prevState => {
      const updatedQuantities = {
        ...prevState,
        [name]: value === "" ? "" : parseInt(value, 10)
      };
      // Treat "" and NaN as 0 for total
      const total = Object.values(updatedQuantities)
        .map(v => (v === "" || isNaN(v)) ? 0 : v)
        .reduce((acc, curr) => acc + curr, 0);
      setTotalPizzas(total);
      return updatedQuantities;
    });
  }
}
  

  const handleSaveEmail = () => {
  setEditingEmail(false);
  };


  // Clear fields when a different customer is selected
  useEffect(() => {
    setPizzaQuantities(pizzaData.reduce((acc, pizza) => {
      acc[pizza.id] = 0;
      return acc;
    }, {}));
    setTotalPizzas(0);
    setAdditionalNotes("");
    setValidated(false);
    setSubmitting(false);
    setPurchaseOrder('');
    setCustomDeliveryDate('');
    setCustomDeliveryWeek('');
    setDeliveryDay('');
    setWastageReason('');
    setDeliveryOption("asap");
    // Reset editable email to the selected customer's email
    setEditableEmail(customerData.find(c => c.account_ID === selectedCustomerId)?.email || "");
     setConfirmChecked(false);
}, [selectedCustomerId, pizzaData]);



  const filteredPizzaData = pizzaData.filter(pizza => {
    if (filterCriteria === "withSleeve") {
      return pizza.sleeve;
    } else if (filterCriteria === "withoutSleeve") {
      return !pizza.sleeve;
    } else {
      return true;
    }
  });
  
  // delivery dates
  const today = dayjs().format('DD-MM-YYYY');
    function getNextWeekMonday() {
    const nextMonday = dayjs().subtract(1, 'day').add(1, 'week').startOf('week');
    return nextMonday.format('DD-MM-YYYY');
  }
  const nextWeek = getNextWeekMonday();
  function getNextNextWeekMonday() {
    const nextNextMonday = dayjs().subtract(1, 'day').add(2, 'week').startOf('week');
    return nextNextMonday.format('DD-MM-YYYY');
  }
  const weekAfterNext = getNextNextWeekMonday();
  const [validated, setValidated] = useState(false);
  // State to store the selected delivery option
  const [deliveryOption, setDeliveryOption] = useState("asap");
  // State to store the custom delivery date
  const [customDeliveryDate, setCustomDeliveryDate] = useState("");
  // Function to handle radio button change
  const handleOptionChange = (event) => {
    setDeliveryOption(event.target.value);
    // Clear the custom delivery date when a predefined option is selected
    if (event.target.value !== 'other') {
      setCustomDeliveryDate("");
    }
  };


const getWeekCommencingMonday = (date) => {
  let resultDate = dayjs(date);
  while (resultDate.day() !== 1) { // 1 is monday on day.js
    resultDate = resultDate.subtract(1, 'day');
  }
  return resultDate;
};
const handleDateChange = (e) => {
  const customDate = e.target.value;
  const weekCommencingMonday = getWeekCommencingMonday(customDate);
  const formattedDate = weekCommencingMonday.format('DD-MM-YYYY');
  
  setCustomDeliveryDate(customDate);
  setCustomDeliveryWeek(formattedDate);
  setError('');
};





//form submit
const handleSubmit = async (event) => {  
  event.preventDefault();
  const form = event.currentTarget;
  
  if (form.checkValidity() === false) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (
    selectedCustomerId !== "SAMPLES/6UGM" &&
    selectedCustomerId !== "WEDDINGSPRIVATEEVENTS" &&
    selectedCustomerId !== "WASTAGE" &&
    (!editableEmail || !editableEmail.includes('@'))
  ) {
    alert("Please enter a valid email address.");
    setSubmitting(false);
    return;
  }
  setValidated(true);
  setSubmitting(true); // ✅ prevent further submissions

  if (selectedCustomerId && filterCriteria) {
  const customerDoc = customerData.find(c => c.account_ID === selectedCustomerId);
  if (customerDoc && customerDoc.id) {
    await updateDoc(doc(db, "customers", customerDoc.id), {
      default_pizza_view: filterCriteria
    });
  }
}
  // Your pizza and stock logic...
  const pizzas = filteredPizzaData.reduce((acc, pizza) => {
    const quantityRequired = pizzaQuantities[pizza.id] >= 0 ? pizzaQuantities[pizza.id] : 0;
    if (quantityRequired > 0) {
      acc[pizza.id] = {
        quantity: quantityRequired,
        batchesUsed: [],
      };
    }
    return acc;
  }, {});

  const finalPO = purchaseOrder.trim() !== '' 
  ? purchaseOrder.trim() 
  : `AUTO-${dayjs().format('YYYYMMDD-HHmmss')}`;

  try {
    const docRef = await addDoc(collection(db, "orders"), {
      timestamp: serverTimestamp(),
      order_placed_timestamp: dayjs().format('YYYY-MM-DD, HH:mm'),
      delivery_week: deliveryOption === 'other' ? customDeliveryWeek : deliveryOption,
      delivery_day: deliveryDay,
      account_ID: selectedCustomerId,
      customer_name: customerData.find(c => c.account_ID === selectedCustomerId)?.customer || "",
      customer_email: editableEmail,
      purchase_order: finalPO,
      pizzas: pizzas,
      pizzaTotal: totalPizzas,
      additional_notes: document.getElementById('additonalNotes').value,
      order_status: "order placed",
      complete: false,
      ...((selectedCustomerId === "SAMPLES/6UGM" || selectedCustomerId === "WEDDINGSPRIVATEEVENTS") && { sample_customer_name: sampleCustomerName }),
      ...(selectedCustomerId === "WASTAGE" && { wastage_reason: wastageReason }),
    });

    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
    setSubmitting(false); // 🔁 Re-enable if failed
  }
};





// export default NewOrder
return (
  <div className='newOrder navContent'>
    <div>
      <h2>Place a new order:</h2>
    </div>

    <Form noValidate validated={validated} onSubmit={handleSubmit} className='newOrderForm'>
    <Form.Group as={Row} className="mb-3">
      <Form.Label column sm={3}><h5>Select Customer:</h5></Form.Label>
      <Col sm={9}>
        <Dropdown show={dropdownOpen} onToggle={() => setDropdownOpen(!dropdownOpen)}>
          <Dropdown.Toggle className='button selectCustomerButton' variant="outline-primary" id="dropdown-customer-select">
            {customerData.find(c => c.account_ID === selectedCustomerId)?.customer || "Select Customer"}
          </Dropdown.Toggle>

          <Dropdown.Menu style={{ maxHeight: '250px' }}>
            <Form.Control
              type="text"
              placeholder="Search Customers"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="mx-3 my-2 w-auto"
            />

            <div className='customersScroll'>
              {customerData
                .filter(customer =>
                  (customer.name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
                  (customer.account_ID || "").toLowerCase().includes(customerSearch.toLowerCase())
                )
                .map((customer, index) => (
                  <Dropdown.Item
                    key={customer.id || index}
                    onClick={() => {
                      setSelectedCustomerId(customer.account_ID);
                      setDropdownOpen(false);
                      setCustomerSearch("");
                    }}
                  >
                    {customer.customer || customer.account_ID}
                  </Dropdown.Item>
                ))}
            </div>
          </Dropdown.Menu>
        </Dropdown>
      </Col>
    </Form.Group>
      {(selectedCustomerId !== "SAMPLES/6UGM" && selectedCustomerId !== "WEDDINGSPRIVATEEVENTS" && selectedCustomerId !== "WASTAGE") && (
      <>
        <p className='today'>{today}</p>
        <p>Account ID: {selectedCustomerId || "—"}</p>
      </>
      )}

      {(selectedCustomerId === "SAMPLES/6UGM" || selectedCustomerId === "WEDDINGSPRIVATEEVENTS") && (
        <Form.Group as={Row} className="orderFormFor" controlId="sampleCustomerName">
          <Form.Label column sm={3}>
            <h4>Customer:</h4>
          </Form.Label>
          <Col sm={9}>
            <Form.Control
              type="text"
              placeholder="Enter customer name"
              value={sampleCustomerName}
              onChange={e => setSampleCustomerName(e.target.value)}
            />
          </Col>
        </Form.Group>
      )}
      <Form.Group className='customerDetails'>
        {(selectedCustomerId !== "SAMPLES/6UGM" && selectedCustomerId !== "WEDDINGSPRIVATEEVENTS" && selectedCustomerId !== "WASTAGE") && (
        <p>Address: {customerAddress} </p>
        )}

        {selectedCustomerId !== "WASTAGE" && (
        <div className='email'>
          {editingEmail ? (
            <>
            <input
              type='email'
              className='emailBox'
              value={editableEmail}
              onChange={(e) => setEditableEmail(e.target.value)}
              onBlur={handleSaveEmail}
              autoFocus
            />
          </>
        ) : (
          <>
            <div>Email: {editableEmail}</div>
            <FontAwesomeIcon
              icon={faEdit}
              className='icon editIcon'
              onClick={() => setEditingEmail(true)}
              />
          </>
        )}
        </div>
        )}
      </Form.Group>
      
      {selectedCustomerId !== "WASTAGE" && (
      <fieldset>
      <Form.Group as={Row} className="mb-3">
        <Form.Label>
          <h5> Delivery Week:</h5>
        </Form.Label>
        <Col sm={10}>
          <Form.Check
            type="radio"
            label="asap"
            value="asap"
            name="deliveryOption"
            id="asap"
            checked={deliveryOption === 'asap'}
            onChange={handleOptionChange}
          />
          <Form.Check
            type="radio"
            label={`next week (W/C ${nextWeek})`}
            value={nextWeek}
            name="deliveryOption"
            id="nextWeek"
            checked={deliveryOption === `${nextWeek}`}
            onChange={handleOptionChange}
          />
          <Form.Check
            type="radio"
            label={`week after next (W/C ${weekAfterNext})`}
            value={weekAfterNext}
            name="deliveryOption"
            id="weekAfterNext"
            checked={deliveryOption === `${weekAfterNext}`}
            onChange={handleOptionChange}
          />
            <Form.Check
            type="radio"
            label="other"
            value="other"
            name="deliveryOption"
            id="other"
            checked={deliveryOption === 'other'}
            onChange={handleOptionChange}
          />
            {deliveryOption === 'other' && (
            <Form.Group controlId="formDate">
            <Form.Label>Specify a week:</Form.Label>
              <Form.Control
                type="date"
                placeholder=''
                value={customDeliveryDate}
                onChange={handleDateChange}
              />
          </Form.Group>
        )}
        </Col>
      </Form.Group>
      <Form.Group as={Row} className="mb-3" controlId="deliveryDay">
        <Form.Label column sm={3}>
          <h5>Delivery Day:</h5>
        </Form.Label>
        <Col sm={9}>
          <Form.Control
            type="date"
            value={deliveryDay}
            onChange={e => setDeliveryDay(e.target.value)}
          />
        </Col>
      </Form.Group>
    </fieldset>
    )}
    
    {selectedCustomerId === "WASTAGE" && (
      <Form.Group as={Row} className="mb-3" controlId="wastageDay">
        <Form.Label column sm={3}>
          <h5>Day of Wastage:</h5>
        </Form.Label>
        <Col sm={9}>
          <Form.Control
            type="date"
            value={deliveryDay}
            onChange={e => setDeliveryDay(e.target.value)}
          />
        </Col>
      </Form.Group>
    )}
    {selectedCustomerId !== "WASTAGE" && (
    <Form.Group as={Row} className="mb-3" controlId="purchaseOrder">
      <Form.Label column sm={3}>
        <h5>Purchase Order:</h5>
      </Form.Label>
      <Col sm={9}>
        <Form.Control
          type="text"
          placeholder="(Optional)"
          value={purchaseOrder}
          onChange={(e) => setPurchaseOrder(e.target.value)}
        />
      </Col>
    </Form.Group>
    )}
      <Form.Label><h5> Pizzas: </h5></Form.Label>
    <fieldset>
    <Form.Group as={Row} className="mb-3">

        <Col sm={9}>
          <Form.Check 
            type="radio" 
            label="With Sleeve" 
            value="withSleeve" 
            checked={filterCriteria === "withSleeve"} 
            onChange={handleFilterChange} 
            inline 
          />
          <Form.Check 
            type="radio" 
            label="Without Sleeve" 
            value="withoutSleeve" 
            checked={filterCriteria === "withoutSleeve"} 
            onChange={handleFilterChange} 
            inline 
          />
          <Form.Check 
            type="radio" 
            label="All Pizzas" 
            value="all" 
            checked={filterCriteria === "all"}
            onChange={handleFilterChange} 
            inline 
          />
        </Col>
      </Form.Group>


      {filteredPizzaData.map(pizza => (
        <Form.Group as={Row} className="mb-3" key={pizza.id} id={pizza.id}>
          <Form.Label column sm={3}>
            {capitalizeWords(pizza.pizza_title)}  {/* Capitalizing each word in the pizza title */}
          </Form.Label>
          <Col sm={9}>
            <Form.Control
              type="number"
              value={pizzaQuantities[pizza.id] === 0 ? "" : pizzaQuantities[pizza.id] || ""}
              name={pizza.id}
              onChange={handleChange}
            />
          </Col>
        </Form.Group>
      ))}
      </fieldset>

      {selectedCustomerId === "WASTAGE" && (
      <Form.Group as={Row} className="mb-3" controlId="wastageReason">
        <Form.Label column sm={3}>
          <h5>Reason for Wastage:</h5>
        </Form.Label>
        <Col sm={9}>
          <Form.Select
            value={wastageReason}
            onChange={(e) => setWastageReason(e.target.value)}
          >
            <option value="">Select reason...</option>
            <option value="sample">Sample</option>
            <option value="out of date">Out of Date</option>
            <option value="staff">Staff</option>
            <option value="other">Other</option>
          </Form.Select>
        </Col>
      </Form.Group>
      )}

      <fieldset>
      <Form.Group as={Row} className="mb-3" controlId="additonalNotes">
      <Form.Label column sm={3}>
      <h5> Additional Notes:</h5>
      </Form.Label>
      <Col sm={9}>
      <Form.Control
        as="textarea"
        rows={3}
        placeholder="..."
        value={additionalNotes}
        name="additionalNotes"
        onChange={handleChange}
        />
      </Col>
    </Form.Group>
    </fieldset>
    <fieldset>
      <p>Total Pizzas: {totalPizzas}</p>
    </fieldset>

    <Form.Group className="mb-3">
      <Form.Check
        required
        label="Confirm input"
        feedback="You must agree before submitting."
        feedbackType="invalid"
        checked={confirmChecked}
        onChange={e => setConfirmChecked(e.target.checked)}
        />
    </Form.Group>
    <Button type="submit" className='button' disabled={submitting}>
      Submit
    </Button>
  </Form>
</div>
);
}


export default NewOrderAdmin;