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

    fetchOrders();
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
    console.log(order)
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
            <p><strong>No. of Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
            <p><strong>Delivery Date:</strong> {selectedOrder.delivery_date}</p>
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