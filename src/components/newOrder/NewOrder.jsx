import './newOrder.css'
import { useState, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import dayjs from 'dayjs';
import { app, db } from '../firebase/firebase';
import { addDoc, getDocs, collection, serverTimestamp } from '@firebase/firestore';


// Hook customer name and account ID
function  NewOrder({customerName, accountID}) {

const [pizzaQuantities, setPizzaQuantities] = useState({});
const [totalPizzas, setTotalPizzas] = useState(0)
const [additionalNotes, setAdditionalNotes] = useState("...");
const [pizzaData, setPizzaData] = useState([]);
const [filterCriteria, setFilterCriteria] = useState("withSleeve");
const [customDeliveryWeek, setCustomDeliveryWeek] = useState("");
const [customerData, setCustomerData] = useState("");
const [customerAddress, setCustomerAddress] = useState("")
const [stock, setStock] = useState([])

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
    if (customerData) {
      const customer = customerData.find(cust => cust.account_ID === accountID);
      if (customer) {
        setCustomerAddress(`${customer.name_number} ${customer.street}, ${customer.city}, ${customer.postcode}`);
      } else {
        setCustomerAddress("");
      }
    } else {
      setCustomerAddress("");
    }
  }, [accountID, customerData]);




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
          [name]: parseInt(value, 10)
        };
        const total = Object.values(updatedQuantities).reduce((acc, curr) => acc + curr, 0);
        setTotalPizzas(total);
        return updatedQuantities;
      });
    }
  }
  



  const findEarliestBatchWithEnoughPizza = (pizzaID, quantityRequired) => {
  // Filter stock for batches of the given pizzaID and sort them by batch_number
  const relevantBatches = stock
  .filter(batch => batch.pizza_id === pizzaID)
  .sort((a, b) => a.batch_number - b.batch_number);

  // Look for the first batch that can fulfill the entire quantity
  const batchWithEnoughStock = relevantBatches.find(batch => batch.quantity_available >= quantityRequired);

  // If a suitable batch is found, return it with the requested quantity
  if (batchWithEnoughStock) {
  return [{ batch_number: batchWithEnoughStock.batch_number, quantity: quantityRequired }];
  }

  // If no single batch can fulfill the order, return null (indicating not enough stock in any single batch)
  return null;
  };




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
  } else {
    setValidated(true);

     // Check stock availability for each pizza
     const pizzas = filteredPizzaData.reduce((acc, pizza) => {
      const quantityRequired = pizzaQuantities[pizza.id] >= 0 ? pizzaQuantities[pizza.id] : 0;

  if (quantityRequired > 0) {
      // Manually split quantity into individual units or chunks for future batch assignment
      acc[pizza.id] = {
        batchesUsed: [
          {
            quantity: quantityRequired,
            batch_number: null  // Manual assignment to happen later
          }
        ]
      };
    }

  return acc;
}, {});

//send to database
  try {
    const docRef = await addDoc(collection(db, "orders"), {
      timestamp: serverTimestamp(),
      order_placed_timestamp: dayjs().format('YYYY-MM-DD, HH:mm'),
      delivery_week: deliveryOption === 'other' ? customDeliveryWeek : deliveryOption,
      delivery_day: "tbc",
      account_ID: accountID,
      customer_name: customerName,
      pizzas: pizzas,  // Store pizzas with their respective batch details
      pizzaTotal: totalPizzas,
      additional_notes: document.getElementById('additonalNotes').value,
      order_status: "order placed",
      complete: false,
    });

    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}
};



// export default NewOrder
return (
  <div className='newOrder'>
    <div>
      <h2>Place a new order:</h2>
    </div>

    <Form noValidate validated={validated} onSubmit={handleSubmit} className='newOrderForm'>

      <h4 className='orderFormFor'>Customer Name: {customerName} </h4> 
      <p className='today'>{today}</p>
      <p>Account ID: {accountID} </p>
      <p>Address: {customerAddress} </p>

      <fieldset>
      <Form.Group as={Row} className="mb-3">
        <Form.Label as="legend" column sm={2}>
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
    </fieldset>
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
              value={pizzaQuantities[pizza.id] !== undefined ? pizzaQuantities[pizza.id] : ""}
              name={pizza.id}
              onChange={handleChange}
            />
          </Col>
        </Form.Group>
      ))}
      Total Pizzas: {totalPizzas}
      </fieldset>


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
    
    <Form.Group className="mb-3">
      <Form.Check
        required
        label="Confirm input"
        feedback="You must agree before submitting."
        feedbackType="invalid"
        />
    </Form.Group>
    <Button type="submit" className='button'>Submit Order</Button>
    <Button className='button' onClick={() =>window.location.reload()}>clear fields</Button>
  </Form>
</div>
);
}


export default NewOrder;