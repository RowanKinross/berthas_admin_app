import './newOrder.css'
import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import dayjs from 'dayjs';

function  NewOrder({customerName}) {
  const today = dayjs().format('DD-MMM-YYYY');
    function getNextWeekMonday() {
    const nextMonday = dayjs().subtract(1, 'day').add(1, 'week').startOf('week');
    return nextMonday.format('DD-MMM-YYYY');
  }
  const nextWeek = getNextWeekMonday();

  function getNextNextWeekMonday() {
    const nextNextMonday = dayjs().subtract(1, 'day').add(2, 'week').startOf('week');
    return nextNextMonday.format('DD-MMM-YYYY');
  }
  const weekAfterNext = getNextNextWeekMonday();
  
  const [validated, setValidated] = useState(false);

  // State to store the selected delivery option
  const [deliveryOption, setDeliveryOption] = useState('');

  // State to store the custom delivery date
  const [customDeliveryDate, setCustomDeliveryDate] = useState('');

  // Function to handle radio button change
  const handleOptionChange = (event) => {
    setDeliveryOption(event.target.value);

    // Clear the custom delivery date when a predefined option is selected
    if (event.target.value !== 'other') {
      setCustomDeliveryDate('');
    }
  };

  const handleSubmit = (event) => {
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      event.preventDefault();
      event.stopPropagation();
    }

    setValidated(true);

  };

  return (
    <div className='newOrder'>
      <div>
        <h2>Place a new order:</h2>
      </div>

      <Form noValidate validated={validated} onSubmit={handleSubmit} className='newOrderForm'>

        <h4 className='orderFormFor'>Customer Name: {customerName} </h4> 
        <p className='today'>{today}</p>
        <p>Account ID: #BERTHA001 </p>
        <p>Address: Bertha's Pizza, The Old Gaol Stables, Cumberland Rd, Bristol BS1 6WW </p>

        <fieldset>
        <Form.Group as={Row} className="mb-3">
          <Form.Label as="legend" column sm={2}>
            <h5> Delivery date:</h5>
          </Form.Label>
          <Col sm={10}>
            <Form.Check
              type="radio"
              label="asap"
              value="asap"
              name="deliveryDate"
              id="asap"
              checked={deliveryOption === 'asap'}
              onChange={handleOptionChange}
            />
            <Form.Check
              type="radio"
              label={`next week (W/C ${nextWeek})`}
              value="nextWeek"
              name="deliveryDate"
              id="nextWeek"
              checked={deliveryOption === 'nextWeek'}
              onChange={handleOptionChange}
            />
            <Form.Check
              type="radio"
              label={`week after next (W/C ${weekAfterNext})`}
              value="weekAfterNext"
              name="deliveryDate"
              id="weekAfterNext"
              checked={deliveryOption === 'weekAfterNext'}
              onChange={handleOptionChange}
            />
              <Form.Check
              type="radio"
              label="other"
              value="other"
              name="deliveryDate"
              id="other"
              checked={deliveryOption === 'other'}
              onChange={handleOptionChange}
            />
              {deliveryOption === 'other' && (
            <Form.Control
              type="text"
              placeholder="Specify a date"
              value={customDeliveryDate}
              onChange={(e) => setCustomDeliveryDate(e.target.value)}
            />
          )}
          </Col>
        </Form.Group>
      </fieldset>
        <Form.Label><h5> Pizzas: </h5></Form.Label>
      <fieldset>

      <Form.Group as={Row} className="mb-3" id='MH'>
        <Form.Label column sm={3}>
          Meat and Heat
        </Form.Label>
        <Col sm={9}>
          <Form.Control type="number" placeholder="0" />
        </Col>
      </Form.Group>
      
      <Form.Group as={Row} className="mb-3" id='H'>
        <Form.Label column sm={3}>
          Hamageddon
        </Form.Label>
        <Col sm={9}>
          <Form.Control type="number" placeholder="0" />
        </Col>
      </Form.Group>

      <Form.Group as={Row} className="mb-3" id='M'>
        <Form.Label column sm={3}>
          Margherita
        </Form.Label>
        <Col sm={9}>
          <Form.Control type="number" placeholder="0" />
        </Col>
      </Form.Group>

      <Form.Group as={Row} className="mb-3" id='N'>
        <Form.Label column sm={3}>
          Napoli
        </Form.Label>
        <Col sm={9}>
          <Form.Control type="number" placeholder="0" />
        </Col>
      </Form.Group>
      
        </fieldset>
      
        <Form.Group as={Row} className="mb-3" controlId="additonalNotes">
        <Form.Label column sm={3}>
        <h5> Additional Notes:</h5>
        </Form.Label>
        <Col sm={9}>
          <Form.Control as="textarea" rows={3} placeholder="..." />
        </Col>
      </Form.Group>
      
      <Form.Group className="mb-3">
        <Form.Check
          required
          label="Confirm input"
          feedback="You must agree before submitting."
          feedbackType="invalid"
          />
      </Form.Group>
      <Button type="submit" className='button' >Submit Order</Button>
    </Form>
  </div>
  );
}

export default NewOrder;