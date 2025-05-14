// import berthasLogo from './bertha_logo'
import './orders.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, doc, updateDoc } from '@firebase/firestore';
import { useState, useEffect, useCallback } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';



function Orders() {
  //make an orders array
  const [orders, setOrders] = useState ([])
  const [viewModal, setViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pizzaTitles, setPizzaTitles] = useState({});
  const [batches, setBatches] = useState({});
  const [dropdownBatches, setDropdownBatches] = useState({});
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}, ${hh}:${min}`;
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    const fetchBatches = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "batches"));
        const batchesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBatches(batchesData);
      } catch (error) {
        console.error("Error fetching batches:", error);
      }
    };

    const fetchPizzaTitles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "pizzas"));
        const titlesMap = {};
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.id && data.pizza_title) {
            titlesMap[data.id] = data.pizza_title;
          }          
        });
        setPizzaTitles(titlesMap);
      } catch (error) {
        console.error("Error fetching pizza titles:", error);
      }
    };
  
    fetchOrders();
    fetchBatches();
    fetchPizzaTitles();
  }, []);
  

  const fetchOrdersAgain = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"));
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };



  const handleComplete =  useCallback(async () => {
    try { 
        // Update existing batch
        const orderRef = doc(db, "orders", selectedOrder.id);
        await updateDoc(orderRef, {
          complete: true,
        });
        handleCloseModal();
        fetchOrdersAgain();
    } catch (error) {
      console.error("Error submitting batch:", error);
    }
  }, [selectedOrder]);


  const handleOrderClick = useCallback((order) => {
    setSelectedOrder(order);
    setViewModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedOrder(null);
    setViewModal(false);
  }, [])


  return (
  <div className='orders'>
    <h2>ORDERS</h2>
    <div className='ordersList'>
      <div className='orderButton' id='totals'>
        <div>Account ID:</div>
        <div>no. of pizzas:</div>
        <div>Delivery Date:</div>
      </div>

      {orders.length > 0 ? (
        orders.map(order => (
          <button 
          key={order.id} 
          className={`orderButton button ${order.complete ? 'complete' : ''}`} 
          onClick={() => handleOrderClick(order)}>
            <div>{order.account_ID}</div>
            <div>{order.pizzaTotal}</div>
            <div>{order.delivery_date}</div>
          </button>
        ))
      ):(
        <p className='py-3'>Loading orders...</p>
      )}
    </div>
    {selectedOrder && (
        <div className='modal'>
          <div className='modalContent'>
          <div>
            <div>Order Details</div>
          </div>
          <div>
            <p><strong>Account ID:</strong> {selectedOrder.account_ID}</p>
            <p><strong>Order Placed: </strong> {formatDate(selectedOrder.timestamp)}</p>
            <p><strong>Delivery Week:</strong> {selectedOrder.delivery_week}</p>
            <p><strong>Delivery Day:</strong> {selectedOrder.delivery_day}</p>
            <strong>Pizzas Ordered:</strong>
            {Object.entries(selectedOrder.pizzas).map(([pizzaName, pizzaData], index) => (
              <div key={index}>
                <div className='container pizzasOrdered'>
                <p>{pizzaTitles[pizzaName] || pizzaName}:</p>
                  {pizzaData.batchesUsed.map((batch, i) => (
                    <div key={i} className='flexRow'>
                    <p>{batch.quantity}</p>
                    <div className='flexRow'>
                    <select
                      onChange={(e) => {
                        const selected = JSON.parse(e.target.value);
                        console.log("Selected batch:", selected);
                      }}
                    >
                      <option value="">Select batch</option>
                      {
                      batches
                      .filter(batch => batch.pizzas.some(p => p.id === pizzaName))
                      .sort((a, b) => a.batch_code.localeCompare(b.batch_code))
                      .map((batch, i) => (
                        <option key={batch.id || i} value={JSON.stringify(batch)}>
                          <p>{batch.batch_code} </p>
                          <p>{batch.pizzas
                          .filter(p => p.id === pizzaName)
                          .map(p => ` (${p.quantity - p.quantity_on_order} in stock)`)}
                          </p>
                      </option>
                      ))}
                    </select>

                  </div>
                  </div>
                  ))}
                </div>
              </div>
            ))}
            <p><strong>Total Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
            <p><strong>Order Status: </strong> {selectedOrder.order_status}</p>
          </div>
          <div>
            <button className='button' onClick={handleComplete}>
              Order Complete
            </button>
            <button className='button' onClick={handleCloseModal}>
              Close
            </button>
          </div>
        </div>
        </div>
      )}
  </div>
  )
}

export default Orders;