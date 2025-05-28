// import berthasLogo from './bertha_logo'
import './orders.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, getDoc, doc, updateDoc } from '@firebase/firestore';
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
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [editingBatch, setEditingBatch] = useState({ pizzaId: null, batchIndex: null });
  const isEditingBatch = (pizzaId, batchIndex) =>
  editingBatch.pizzaId === pizzaId && editingBatch.batchIndex === batchIndex;

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

  const formatDeliveryDay = (input) => {
    if (!input) return '';
    let date;
  if (typeof input.toDate === 'function') {
    date = input.toDate();
  } else {
    date = new Date(input);
  }
  if (isNaN(date.getTime())) return ''; // handle invalid date
  const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
  const dayOfWeek = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dayOfWeek}, ${dd}-${mm}-${yyyy}`;
  };

  const sortOrders = (orders) => {
  const now = new Date();
  return [...orders].sort((a, b) => {
    const getDateValue = (order) => {
      if (order.delivery_day === 'tbc') return null;
      const date = new Date(order.delivery_day);
      return isNaN(date.getTime()) ? null : date;
    };
    const aDate = getDateValue(a);
    const bDate = getDateValue(b);
    // Case 1: Both TBC — sort by order timestamp descending (newest first)
    if (!aDate && !bDate) {
      return b.timestamp?.toDate() - a.timestamp?.toDate();
    }
    // Case 2: Only A is TBC
    if (!aDate) return -1;
    // Case 3: Only B is TBC
    if (!bDate) return 1;
    const nowTime = now.getTime();
    const aTime = aDate.getTime();
    const bTime = bDate.getTime();
    const aIsPast = aTime < nowTime;
    const bIsPast = bTime < nowTime;
    // Case 4: A is future, B is past => A goes first
    if (!aIsPast && bIsPast) return -1;
    // Case 5: A is past, B is future => B goes first
    if (aIsPast && !bIsPast) return 1;
    // Case 6: Both in future — soonest first
    if (!aIsPast && !bIsPast) return aTime - bTime;
    // Case 7: Both in past — latest past goes lower
    return aTime - bTime;
  });
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
  
const updateDeliveryDate = async (orderId, newDate) => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, { delivery_day: newDate });

    // ✅ Refresh full order and update local state
    const updatedOrderSnap = await getDoc(orderRef);
    const freshOrderData = updatedOrderSnap.data();
    const fullyUpdatedOrder = { ...freshOrderData, id: orderId };

    setSelectedOrder(fullyUpdatedOrder);
    setEditingDeliveryDate(false);
    setDeliveryDateInput('');
    fetchOrdersAgain();
  } catch (error) {
    console.error("Error updating delivery date:", error);
  }
};


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

  const getAvailableQuantity = (batch, pizzaId, currentOrderId) => {
  const pizza = batch.pizzas.find(p => p.id === pizzaId);
  if (!pizza) return 0;

  const allocated = (batch.pizza_allocations || [])
    .filter(a => a.pizzaId === pizzaId && a.orderId !== currentOrderId)
    .reduce((sum, a) => sum + a.quantity, 0);

  return pizza.quantity - allocated;
};





 const handleBatchNumberUpdate = async ({ orderId, pizzaId, batchIndex, batchNumber }) => {
   const orderRef = doc(db, "orders", orderId);
  try {
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) throw new Error("Order not found");

    const orderData = orderSnap.data();
    const batchesUsed = orderData.pizzas?.[pizzaId]?.batchesUsed || [];
    const selectedBatch = batchesUsed[batchIndex];
    const quantityOrdered = selectedBatch.quantity;

    const prevBatchCode = selectedBatch.batch_number;

    // Update Firestore order with new batch_number
    selectedBatch.batch_number = batchNumber;
    await updateDoc(orderRef, {
      [`pizzas.${pizzaId}.batchesUsed`]: batchesUsed
    });
    // Update old batch (remove allocation)
    if (prevBatchCode && prevBatchCode !== batchNumber) {
      const prevBatchDoc = batches.find(b => b.batch_code === prevBatchCode);
      if (prevBatchDoc) {
        const updatedAllocations = (prevBatchDoc.pizza_allocations || []).filter(
          a => !(a.orderId === orderId && a.pizzaId === pizzaId && a.quantity === quantityOrdered)
        );
        await updateDoc(doc(db, "batches", prevBatchDoc.id), {
          pizza_allocations: updatedAllocations
        });
      }
    }
    // Add new allocation
    const newBatchDoc = batches.find(b => b.batch_code === batchNumber);
    if (newBatchDoc) {
      const newAllocations = [...(newBatchDoc.pizza_allocations || []), {
        orderId,
        pizzaId,
        quantity: quantityOrdered
      }];
      await updateDoc(doc(db, "batches", newBatchDoc.id), {
        pizza_allocations: newAllocations
      });
    }
    console.log("✅ Allocation updated.");
  } catch (error) {
    console.error("Error allocating batch:", error);
  }

  // Re-fetch updated order after assigning the batch
  const updatedOrderSnap = await getDoc(orderRef);
  const updatedOrder = updatedOrderSnap.data();

  // Check if all batches are allocated
  if (allPizzasAllocated(updatedOrder)) {
    await updateDoc(orderRef, { order_status: "pizzas allocated" });
    console.log("✅ Order status updated to 'pizzas allocated'");
  }
  
};



  const handleComplete =  useCallback(async () => {
    try { 
        // Update existing batch
        const orderRef = doc(db, "orders", selectedOrder.id);
        await updateDoc(orderRef, {
          complete: true,
          order_status: "complete"
        });
        // Update any batch allocations related to this order
        const batchesSnapshot = await getDocs(collection(db, "batches"));
        const batchDocs = batchesSnapshot.docs;

        const updates = batchDocs.map(async (docSnap) => {
          const batchData = docSnap.data();
          let updated = false;

          const updatedAllocations = (batchData.pizza_allocations || []).map(allocation => {
            if (allocation.orderId === selectedOrder.id) {
              updated = true;
              return { ...allocation, status: "completed" };
            }
            return allocation;
          });

          if (updated) {
            await updateDoc(doc(db, "batches", docSnap.id), {
              pizza_allocations: updatedAllocations
            });
          }
        });

        await Promise.all(updates);
        
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

  const allPizzasAllocated = (order) => {
  return Object.values(order.pizzas).every(pizza =>
    pizza.batchesUsed.every(batch => !!batch.batch_number)
  );
};


  return (
  <div className='orders'>
    <h2>ORDERS</h2>
    <div className='ordersList'>
      <div className='orderButton' id='totals'>
        <div>Account ID:</div>
        <div>no. of pizzas:</div>
        <div>Order Status</div>
        <div>Delivery Day:</div>
        {/* <button onClick={initializeAllocations}>Init Allocations</button> */}
      </div>

      {orders.length > 0 ? (
        sortOrders(orders).map(order => (
          <button 
          key={order.id} 
          className={`orderButton button 
            ${order.complete ? 'complete' : ''} 
            ${order.order_status === 'pizzas allocated' ? 'allocated' : ''}`}
 
          onClick={() => handleOrderClick(order)}>
            <div>{order.account_ID}</div>
            <div>{order.pizzaTotal}</div>
            <div>{order.order_status}</div>
            <div className={`${order.delivery_day === 'tbc'? 'tbc' : ''}`}>
              {order.delivery_day ==='tbc'? 'tbc' : formatDeliveryDay(order.delivery_day)}
            </div>
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
            <p className='flexRow'>
              <strong className='space'>Delivery Day:</strong>{" "}
              {editingDeliveryDate ? (
                <>
                  <input
                    type="date"
                    value={deliveryDateInput}
                    onChange={(e) => setDeliveryDateInput(e.target.value)}
                    onBlur={() => {
                      if (deliveryDateInput) {
                        updateDeliveryDate(selectedOrder.id, deliveryDateInput);
                      } else {
                        setEditingDeliveryDate(false);
                      }
                    }}
                    autoFocus
                  />
                </>
              ) : (
                <span
                  className="clickable "
                  onClick={() => {
                    setEditingDeliveryDate(true);
                    setDeliveryDateInput(selectedOrder.delivery_day || '');
                  }}
                >
                <div className={`${selectedOrder.delivery_day === 'tbc'? 'tbc' : ''}`}>
                  {selectedOrder.delivery_day ==='tbc'? 'select day' : formatDeliveryDay(selectedOrder.delivery_day)}
                </div>
                </span>
              )}
            </p>
            <strong>Pizzas Ordered:</strong>
            {Object.entries(selectedOrder.pizzas).map(([pizzaName, pizzaData], index) => (
              <div key={index}>
                <div className=' pizzasOrdered'>
                
                {pizzaData.batchesUsed.map((batch, i) => (
                  <div key={i} className=''>
                    <div className='flexRow'>
                    <p className='space'>{pizzaTitles[pizzaName] || pizzaName}:</p>
                    <p>{batch.quantity}</p>
                    </div>
                    <div className='flexRow'>
                      <p className='flexRow'>batch code:</p>
                      {isEditingBatch(pizzaName, i) ? (
                        <select
                          value={batch.batch_number || ""}
                          onChange={async (e) => {
                            const selectedBatchCode = e.target.value;

                            await handleBatchNumberUpdate({
                              orderId: selectedOrder.id,
                              pizzaId: pizzaName,
                              batchIndex: i,
                              batchNumber: selectedBatchCode,
                            });

                            // Update local state
                            const updatedOrder = { ...selectedOrder };
                            updatedOrder.pizzas[pizzaName].batchesUsed[i].batch_number = selectedBatchCode;

                            if (allPizzasAllocated(updatedOrder)) {
                              updatedOrder.order_status = "pizzas allocated";
                            }

                            setSelectedOrder(updatedOrder);
                            setEditingBatch({ pizzaId: null, batchIndex: null }); // close dropdown
                            fetchOrdersAgain();
                          }}
                          onBlur={() => setEditingBatch({ pizzaId: null, batchIndex: null })}
                          autoFocus
                        >
                          <option value="">Select batch</option>
                          {batches
                            .filter(batch => batch.pizzas.some(p => p.id === pizzaName))
                            .sort((a, b) => a.batch_code.localeCompare(b.batch_code))
                            .map((batch, i) => {
                              const available = getAvailableQuantity(batch, pizzaName, selectedOrder.id);
                              return (
                                <option
                                  key={batch.id || i}
                                  value={batch.batch_code}
                                  disabled={available < batch.quantity}
                                >
                                  {batch.batch_code} — ({available} available)
                                </option>
                              );
                            })}
                        </select>
                      ) : (
                        <span
                          className="clickable"
                          onClick={() => setEditingBatch({ pizzaId: pizzaName, batchIndex: i })}
                        >
                          {batch.batch_number || <em className='tbc'>select batch</em>}
                        </span>
                      )}
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