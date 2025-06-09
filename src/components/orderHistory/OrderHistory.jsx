import './orderHistory.css';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, updateDoc } from '@firebase/firestore';
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faSave, faPrint } from '@fortawesome/free-solid-svg-icons';
import { formatDate, formatDeliveryDay } from '../../utils/formatDate';

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

  const handlePrintClick = () => {
    const modalContent = document.querySelector('.orderHistoryModal');
    // Clone content
    const clone = modalContent.cloneNode(true);
    // Remove the buttons
    clone.querySelectorAll('button').forEach(btn => btn.remove());
    // Open print window
    const newWindow = window.open('', '', 'width=800,height=600');
    newWindow.document.write(`
      <html>
        <head>
          <title>Order Details</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            .modalContent {
              border: 1px solid #ccc;
              padding: 20px;
            }
            h3, h4 {
              margin-top: 0;
            }
          </style>
        </head>
        <body>
          ${clone.innerHTML}
        </body>
      </html>
    `);
    newWindow.document.close();
    newWindow.focus();
    newWindow.print();
    newWindow.close();
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

  const transformPizzasObjectToArray = (pizzas) => {
    console.log('Pizzas object:', pizzas);
    return Object.keys(pizzas).map(pizzaID => {
      const pizza = pizzas[pizzaID];

          // Use the pizzaNameMap to get the name, fallback to pizzaID if not found
    const pizzaName = pizzaNameMap[pizzaID] || pizzaID;
      
      // Combine batch info into a string
      const batchDetails = pizza.batchesUsed.map(batch => `${batch.batch_number} (qty: ${batch.quantity})`).join(', ');
  
      return {
        name: pizzaName,
        quantity: pizza.quantity,
        batchDetails: batchDetails
      };
    });
  };

  return (
    <div className="orders">
      <h2>ORDER HISTORY</h2>
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
              <div className="orderEntries">{formatDate(order.order_placed_timestamp)}</div>
              <div className="orderEntries">{order.pizzaTotal}</div>
              <div className="orderEntries">{formatDeliveryDay(order.delivery_week)}</div>
              <div className="orderEntries">{formatDeliveryDay(order.delivery_day)}</div>
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
                <p><strong>Order Placed:</strong> {formatDate(selectedOrder.order_placed_timestamp)}</p>
                <p><strong>Delivery Week:</strong> {selectedOrder.delivery_week}</p>
                <p><strong>Delivery Day:</strong> {formatDeliveryDay(selectedOrder.delivery_day)}</p>
                <p><strong>Order Status:</strong> {selectedOrder.order_status}</p>
                {selectedOrder.pizzas ? (
                  <div>
                    <h4>Pizzas Ordered:</h4>
                    <ul>
                      {transformPizzasObjectToArray(selectedOrder.pizzas).map((pizza, index) => (
                        <li key={index}>
                          {pizza.name} x {pizza.quantity} (batch: {pizza.batchDetails})
                        </li>
                      ))}
                    </ul>
                  </div>
                  ) : (
                    <p>No pizzas ordered.</p>
                )}
                <p><strong>Total no. of Pizzas:</strong> {selectedOrder.pizzaTotal}</p>

                
                <button className='editButton' onClick={handleEditClick}>
                  <FontAwesomeIcon icon={faEdit} className='icon' /> Edit
                </button>
                <button className='printButton' onClick={handlePrintClick}>
                  <FontAwesomeIcon icon={faPrint} className='icon' /> Print
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
