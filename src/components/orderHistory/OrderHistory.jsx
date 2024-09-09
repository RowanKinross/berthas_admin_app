import './orderHistory.css';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, updateDoc } from '@firebase/firestore';
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faSave } from '@fortawesome/free-solid-svg-icons';

const OrderHistory = ({ accountID }) => {
  const [orders, setOrders] = useState([]);
  const [viewModal, setViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pizzaNameMap, setPizzaNameMap] = useState({});
  const [editMode, setEditMode] = useState(false);

  // Handle edit mode toggle
  const handleEditClick = () => {
    setEditMode(true);
  };

  const handleSaveClick = () => {
    updateOrderDetails();
    setEditMode(false);
  };

  const updateOrderDetails = async () => {
    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        delivery_week: selectedOrder.delivery_week,
        delivery_day: selectedOrder.delivery_day,
        pizzas: selectedOrder.pizzas,
        order_status: selectedOrder.order_status,
      });
      console.log('Order details updated successfully!');
      handleCloseModal();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        const ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    };

    const fetchPizzaNameMap = async () => {
      try {
        const pizzaNameSnapshot = await getDocs(collection(db, 'pizzas'));
        const nameMap = {};
        pizzaNameSnapshot.forEach(doc => {
          const pizzaData = doc.data(); // Get the document data
          const pizzaID = pizzaData.id; // Extract pizza.id from the document data
          const pizzaTitle = pizzaData.pizza_title; // Extract pizza_title from the document data
          nameMap[pizzaID] = pizzaTitle; // Map pizza.id to pizza_title
        });
        setPizzaNameMap(nameMap); // Save the map to state
      } catch (error) {
        console.error('Error fetching pizza name mappings:', error);
      }
    };

    fetchOrders();
    fetchPizzaNameMap();
  }, []);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setViewModal(true);
  };

  const handleCloseModal = () => {
    setViewModal(false);
    setSelectedOrder(null);
    setEditMode(false);
  };

  const transformPizzasObjectToArray = (pizzasObject) => {
    return Object.keys(pizzasObject)
      .filter(pizzaId => pizzasObject[pizzaId] > 0)
      .map(pizzaId => ({
        name: pizzaNameMap[pizzaId] || pizzaId,
        quantity: pizzasObject[pizzaId],
      }));
  };

  return (
    <div className="orders">
      <h2>ORDERS</h2>
      <div className="ordersList">
        <div className="orderButton orderHeaders">
          <div className="entries">Order Placed:</div>
          <div className="entries">No. of Pizzas:</div>
          <div className="entries">Delivery Week:</div>
          <div className="entries">Delivery Day:</div>
          <div className="entries">Order Status:</div>
        </div>
        {orders
          .filter(order => order.account_ID === accountID)
          .sort((a, b) => new Date(b.order_placed_timestamp) - new Date(a.order_placed_timestamp))
          .map(order => (
            <button
              key={order.id}
              className={`orderButton button ${order.complete ? 'complete' : ''}`}
              onClick={() => handleOrderClick(order)}
            >
              <div className="orderEntries">{order.order_placed_timestamp}</div>
              <div className="orderEntries">{order.pizzaTotal}</div>
              <div className="orderEntries">{order.delivery_week}</div>
              <div className="orderEntries">{order.delivery_day}</div>
              <div className="orderEntries">{order.order_status}</div>
            </button>
          ))}
      </div>
      {viewModal && selectedOrder && (
        <div className="modal">
          <div className="modalContent orderHistoryModal">
            <div>
              <h3>Order Details</h3>
            </div>
            {editMode ? (
              <>
                <div>
                  <label>Delivery Week:</label>
                  <input
                    type="text"
                    value={selectedOrder.delivery_week}
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, delivery_week: e.target.value })}
                  />
                </div>
                <div>
                  <label>Delivery Day:</label>
                  <input
                    type="text"
                    value={selectedOrder.delivery_day}
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, delivery_day: e.target.value })}
                  />
                </div>
                <div>
                  <label>Order Status:</label>
                  <input
                    type="text"
                    value={selectedOrder.order_status}
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, order_status: e.target.value })}
                  />
                </div>
                <button className="button saveButton" onClick={handleSaveClick}>
                  <FontAwesomeIcon icon={faSave} className='icon' /> Save
                </button>
              </>
            ) : (
              <div>
                <p><strong>Account ID:</strong> {selectedOrder.account_ID}</p>
                <p><strong>Order Placed:</strong> {selectedOrder.order_placed_timestamp}</p>
                <p><strong>Delivery Week:</strong> {selectedOrder.delivery_week}</p>
                <p><strong>Delivery Day:</strong> {selectedOrder.delivery_day}</p>
                <p><strong>Order Status:</strong> {selectedOrder.order_status}</p>
                {selectedOrder.pizzas && (
                  <div>
                    <h4>Pizzas Ordered:</h4>
                    <ul>
                      {transformPizzasObjectToArray(selectedOrder.pizzas).map((pizza, index) => (
                        <li key={index}>
                          {pizza.name} x {pizza.quantity} (batch: placeholder batchcode)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p><strong>Total no. of Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
                <button className='editButton' onClick={handleEditClick}>
                  <FontAwesomeIcon icon={faEdit} className='icon' /> Edit
                </button>
              </div>
            )}
            <button className="button" onClick={handleCloseModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
