// import berthasLogo from './bertha_logo'
import './orders.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, getDoc, doc, updateDoc, writeBatch } from '@firebase/firestore';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {faPrint} from '@fortawesome/free-solid-svg-icons';
import { formatDate, formatDeliveryDay } from '../../utils/formatDate';
import { fetchCustomerByAccountID } from '../../utils/firestoreUtils';
import { onSnapshot } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function Orders() {
  //make an orders array
  const [orders, setOrders] = useState ([])
  const [viewModal, setViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pizzaTitles, setPizzaTitles] = useState({});
  const [batches, setBatches] = useState({});
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const modalRef = useRef(null)
  const [customerInfo, setCustomerInfo] = useState(null);
  const [allCustomers, setAllCustomers] = useState({})
  // select mode on the orders
  const [selectMode, setSelectMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [batchErrors, setBatchErrors] = useState({});
  const [isSplitChecked, setIsSplitChecked] = useState(false);
  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 20;

  const [packingHtml, setPackingHtml] = useState('');



useEffect(() => {
  const fetchAllCustomers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "customers"));
      const customerMap = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.account_ID) {
          customerMap[data.account_ID] = data;
        }
      });
      setAllCustomers(customerMap);
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  fetchAllCustomers();
}, []);






const sortOrders = (orders) => {
  return [...orders].sort((a, b) => {
    const aDate = a.delivery_day === 'tbc' ? null : new Date(a.delivery_day);
    const bDate = b.delivery_day === 'tbc' ? null : new Date(b.delivery_day);

    if (!aDate && !bDate) {
      return b.timestamp?.toDate() - a.timestamp?.toDate();
    }
    //TBCs at the top
    if (!aDate) return -1;
    if (!bDate) return 1;

    // oldest at the bottom
    return bDate - aDate;
  });
};


const formatBatchDate = (code) => {
  if (!code || code.length !== 8) return '';
  const year = code.slice(0, 4);
  const month = code.slice(4, 6);
  const day = code.slice(6, 8);
  return `${day}.${month}.${year}`;
};


const handleBatchQuantityChange = async (pizzaId, batchCode, newQuantity) => {
  const order = { ...selectedOrder };
  const pizza = order.pizzas[pizzaId];
  const batches = [...pizza.batchesUsed];
  const index = batches.findIndex(b => b.batch_number === batchCode);

  if (index === -1) return;

  batches[index].quantity = newQuantity;
  order.pizzas[pizzaId].batchesUsed = batches;
  setSelectedOrder(order);

  await syncPizzaAllocation({
    pizzaId,
    batchCode,
    quantity: newQuantity
  });

  try {
    await updateDoc(doc(db, "orders", selectedOrder.id), {
      [`pizzas.${pizzaId}.batchesUsed`]: batches,
    });
  } catch (error) {
    console.error("Error updating batch quantities in Firestore:", error);
  }
  validateAndUpdateOrderStatus(updatedOrder)
};





  useEffect(() => {
  const handleClickOutside = (event) => {
    if (modalRef.current && !modalRef.current.contains(event.target)) {
      setSelectedOrder(null);
      setViewModal(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, []);


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
    fetchPizzaTitles();
  }, []);

  // fetch batches using a listener
  useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, "batches"), (querySnapshot) => {
    const batchesData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setBatches(batchesData);
  }, (error) => {
    console.error("Error fetching batches in real-time:", error);
  });
    return () => unsubscribe(); // cleanup listener
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


  useEffect(() => {
  const getCustomer = async () => {
    if (!selectedOrder?.account_ID) return;
    try {
      const customer = await fetchCustomerByAccountID(selectedOrder.account_ID);
      setCustomerInfo(customer);
    } catch (error) {
      console.error("Error fetching customer info:", error);
    }
  };
    getCustomer();
  }, [selectedOrder]);



  
  const getAvailableQuantity = (batch, pizzaId, currentOrderId) => {
  const pizza = batch.pizzas.find(p => p.id === pizzaId);
  if (!pizza) return 0;

  const allocated = (batch.pizza_allocations || [])
    .filter(a => a.pizzaId === pizzaId && a.orderId !== currentOrderId)
    .reduce((sum, a) => sum + a.quantity, 0);

  return pizza.quantity - allocated;
  };


    const syncPizzaAllocation = async ({ pizzaId, batchCode, quantity }) => {
      const batchDoc = batches.find(b => b.batch_code === batchCode);
      if (!batchDoc) return;
      const allocations = batchDoc.pizza_allocations || [];
      const orderId = selectedOrder.id;
      // Remove any existing allocation for this order/pizza/batch
      const filtered = allocations.filter(
        a => !(a.orderId === orderId && a.pizzaId === pizzaId)
      );
      // If quantity is > 0, re-add it
      if (quantity > 0) {
        filtered.push({ orderId, pizzaId, quantity });
      }
      try {
        await updateDoc(doc(db, "batches", batchDoc.id), {
          pizza_allocations: filtered
        });
      } catch (error) {
        console.error("Error syncing pizza allocation:", error);
      }
    };


    const markSelectedAsPacked = async (orderIds = selectedOrders) => {
      try {
        const batch = writeBatch(db);
        orderIds.forEach(orderId => {
          const orderRef = doc(db, "orders", orderId);
          batch.update(orderRef, { order_status: "packed" });
        });
        await batch.commit();
        fetchOrdersAgain();
        setSelectedOrders([]);
        setSelectMode(false);
      } catch (error) {
        console.error("❌ Error marking orders as packed:", error);
      }
    };


  const handleBatchClick = async (pizzaName, batchCode) => {
  const currentBatches = [...selectedOrder.pizzas[pizzaName].batchesUsed];
  const index = currentBatches.findIndex(b => b.batch_number === batchCode);
  const totalQty = selectedOrder.pizzas[pizzaName].quantity;
  let newBatches;
  let newQuantity = 0;
  if (isSplitChecked) {
    if (index !== -1) {
      // deselect
      newBatches = currentBatches.filter(b => b.batch_number !== batchCode);
      newQuantity = 0;
    } else {
      newBatches = [...currentBatches, { batch_number: batchCode, quantity: 0 }];
      newQuantity = 0;
    }
  } else {
    if (index !== -1) {
      newBatches = []; // deselect
      newQuantity = 0;
    } else {
      newBatches = [{ batch_number: batchCode, quantity: totalQty }];
      newQuantity = totalQty;
    }
  }
  const updatedOrder = { ...selectedOrder };
  updatedOrder.pizzas[pizzaName].batchesUsed = newBatches;
  setSelectedOrder(updatedOrder);
  try {
    await updateDoc(doc(db, "orders", selectedOrder.id), {
      [`pizzas.${pizzaName}.batchesUsed`]: newBatches,
    });
    await syncPizzaAllocation({
      pizzaId: pizzaName,
      batchCode,
      quantity: newQuantity
    });
    } catch (error) {
      console.error("Error updating batch assignment:", error);
    }
    validateAndUpdateOrderStatus(updatedOrder)
  };


  const validateAndUpdateOrderStatus = async (order) => {
    const hasErrors = orderHasBatchErrors(order);
    const newStatus = hasErrors ? "order placed" : "ready to pack";
    if (order.order_status !== newStatus) {
      const updatedOrder = { ...order, order_status: newStatus };
      setSelectedOrder(updatedOrder); // update local for temp purposes
      try {
        await updateDoc(doc(db, "orders", order.id), {
          order_status: newStatus
        });
        await fetchOrdersAgain();
      } catch (error) {
        console.error("Error updating order status:", error);
      }
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


const orderHasBatchErrors = (order) => {
  return Object.entries(order.pizzas).some(([pizzaName, pizzaData]) => {
    const totalOrdered = pizzaData.quantity;
    const selectedBatches = pizzaData.batchesUsed.filter(b => b.batch_number);
    const totalAssigned = selectedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    if (selectedBatches.length === 0) return true;
    if (!isSplitChecked) {
      const batch = batches.find(b => b.batch_code === selectedBatches[0]?.batch_number);
      if (!batch) return true;
      const available = getAvailableQuantity(batch, pizzaName, order.id);
      return available < totalOrdered;
    } else {
      const anyOverused = selectedBatches.some(b => {
        const batch = batches.find(batch => batch.batch_code === b.batch_number);
        return !batch || b.quantity > getAvailableQuantity(batch, pizzaName, order.id);
      });
      return anyOverused || totalAssigned !== totalOrdered;
    }
  });
};

  const sortedOrders = sortOrders(orders);
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = sortedOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  



// PACKING LIST
  const generatePDF = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id));

    let html = `<html><head><title>Combined Orders</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .order-block { margin-bottom: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 1rem; }
      h3 { margin-top: 0; }
    </style></head><body>`;

    selected.forEach(order => {
      const customerName = order.customer_name || order.account_ID ;
      html += `<div class="order-block">
        <h3>${customerName}</h3>
        <p><strong>Total Pizzas:</strong> ${order.pizzaTotal}</p>`;

      Object.entries(order.pizzas).forEach(([pizzaId, pizzaData]) => {
        const pizzaName = pizzaTitles[pizzaId] || pizzaId;
        pizzaData.batchesUsed.forEach(b => {
          const batchDate = formatBatchDate(b.batch_number);
          const batchCode = b.batch_number || 'unassigned';
          html += `<p>${pizzaName} x ${b.quantity} batch: ${batchDate ? ` ${batchDate}` : ''}</p>`;
        });
      });


      html += `</div>`;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };


// PACKING SLIP 
const handlePrintClick = () => {
  const order = selectedOrder;

  const customerName = order.customer_name || order.account_ID;
  const po = order.purchase_order || '—';
  const date = formatDate(order.timestamp);
  const address = [
    order.customer_name,
    // order.name_number,
    // order.street,
    // order.city,
    // order.postcode,
    'GBR'
  ].filter(Boolean).join('<br/>');

  let html = `
  <div style="page-break-after: always; font-family: Arial, sans-serif; font-size: 14px; padding: 40px; max-width: 700px; margin: auto;">

    <div style="text-align: center; margin-bottom: 20px;">
      <img src="/bertha_logo.png" style="max-height: 80px;" />
    </div>
    <h2 style=" margin-bottom: 30px;">PACKING SLIP</h2>

    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <div style="border: 1px solid #000; padding: 10px; width: 48%;">
        <strong>Deliver to</strong><br/>
        ${address}
      </div>
      <div style=" padding: 10px; width: 48%;">
        <strong>Bill to</strong><br/>
        ${address}
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <div style="margin-bottom: 20px;">
        <strong>Invoice Date:</strong> ${date}<br/>
        <strong>Invoice Number:</strong> INV-${order.id.slice(-4).toUpperCase()}<br/>
        <strong>Reference:</strong> PO ${po}
      </div>
      <div style="margin-bottom: 20px;">
        <strong>Bertha's At Home</strong><br/>
        accounts@berthas.co.uk<br/>
        sales@berthas.co.uk<br/>
        <strong>VAT Number:</strong> 458323187
      </div>
    </div>

    <table style="width:100%; border-collapse: collapse;">
      <thead style="border-bottom: 2px solid #000;">
        <tr>
          <th style="text-align: left; padding: 6px 0;">Description</th>
          <th style="text-align: left; padding: 6px 0;">Quantity</th>
        </tr>
      </thead>
      <tbody>`;


      Object.entries(order.pizzas).forEach(([pizzaId, pizzaData]) => {
    const pizzaName = pizzaTitles[pizzaId] || pizzaId;
    pizzaData.batchesUsed.forEach(b => {
      const batchDate = formatBatchDate(b.batch_number); // e.g., 26.06.2025
      const quantity = parseFloat(b.quantity || 0).toFixed(2);
      html += `
          <tr>
            <td style="padding: 4px 0;">${pizzaName} ${batchDate}</td>
            <td style="padding: 4px 0;">${quantity}</td>
          </tr>`;
    });
  });

  html += `
        </tbody>
      </table>
    </div>`;

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
};






  
  return (
  <div className='orders'>
    <h2>ORDERS</h2>
    <div style={{ marginBottom: '1rem' }}>
      <button
        className='button'
        onClick={() => {
          if (selectMode) {
            setSelectedOrders([]); // clear selected orders when exiting selection mode
          }
          setSelectMode(!selectMode);
        }}
      >
        {selectMode ? "Cancel Selection" : "Select Orders"}
      </button>
      {selectedOrders.length > 0 && (
        <div className="bulk-actions">
          {/* generate Packing list button */}
          <button className="button" onClick={generatePDF}>
            Generate Packing List
          </button>
          {/* mark as packed */}
          <button className="button" onClick={markSelectedAsPacked}>
            Mark as Packed
          </button>
        </div>
      )}

    </div>

    <div className='ordersList'>
      <div className='orderButton' id='totals'>
        <div>Account Name:</div>
        <div>No. of Pizzas:</div>
        <div className='orderStatus'>Order Status:</div>
        <div>Delivery Day:</div>
        <div>Region:</div>
      </div>

    {orders.length > 0 ? (
      
      currentOrders.map(order => { 
        const orderCustomer = allCustomers[order.account_ID];
      return(
          <div className="orderRow" key={order.id}>
            {selectMode && (
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={() => {
                    setSelectedOrders(prev =>
                      prev.includes(order.id)
                      ? prev.filter(id => id !== order.id)
                      : [...prev, order.id]
                    );
                  }}
                  />
              </div>
            )}
            
          <button 
            key={order.id}
            className={`orderButton button 
              ${order.complete ? 'complete' : ''} 
              ${order.order_status === 'ready to pack' ? 'allocated' : ''}
              ${order.order_status === 'packed' ? 'packed' : ''}
              `}
              onClick={() => handleOrderClick(order)}
              
              >
            <div>{order.customer_name}</div>
            <div>{order.pizzaTotal}</div>
            <div className='orderStatus'>{order.order_status}</div>
            <div className={`${order.delivery_day === 'tbc' ? 'tbc' : ''}`}>
              {order.delivery_day === 'tbc' ? 'tbc' : formatDeliveryDay(order.delivery_day)}
            </div>
            <div>{orderCustomer?.delivery_region || '—'}</div>
          </button>
        </div>
        )})
      ):(
        <p className='py-3'>Loading orders...</p>
      )}
    </div>
    <div className="pagination">
      {Array.from({ length: Math.ceil(orders.length / ordersPerPage) }, (_, index) => (
        <button
          key={index + 1}
          className={`page-button ${currentPage === index + 1 ? 'active' : ''}`}
          onClick={() => setCurrentPage(index + 1)}
        >
          {index + 1}
        </button>
      ))}
    </div>
    {selectedOrder && (
        <div className='modal'>
          <div className='modalContent orderModal' ref={modalRef}>
          <div>
            <div>Order Details</div>
          </div>
          <div>
            <p><strong>Account ID:</strong> {selectedOrder.account_ID}</p>
            <p><strong>Account Name:  </strong> {customerInfo?.customer || 'N/A'}</p>
            <div><p><strong>Address:</strong></p><br />
                  <div className='displayAddress'>
                    {customerInfo?.customer || 'N/A'} <br/>
                    {customerInfo?.name_number && (
                      <>{customerInfo.name_number}<br/></>
                    )}                    
                    {customerInfo?.street && (
                      <>{customerInfo.street}<br/></>
                    )}
                    {customerInfo?.city && (
                      <>{customerInfo.city}<br/></>
                    )}
                    {customerInfo?.postcode && (
                      <>{customerInfo.postcode}<br/></>
                    )}
                  </div>
              <p><strong>Region:</strong> {customerInfo?.delivery_region|| 'N/A'}</p>
              <p><strong>PO:</strong> {selectedOrder.purchase_order|| 'N/A'}</p>
            </div>
            <p><strong>Order Placed: </strong> {formatDate(selectedOrder.timestamp)}</p>
            <p><strong>Delivery Week:</strong> {selectedOrder.delivery_week}</p>
            <div className='flexRow'>
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
            </div>
            <div className='split'>
            <strong>Pizzas Ordered:</strong>
              <label className="switch" title='split over multiple batch codes?'>
                <input 
                  type="checkbox"
                  checked={isSplitChecked}
                  onChange={(e) => setIsSplitChecked(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            {Object.entries(selectedOrder.pizzas).map(([pizzaName, pizzaData], index) => (
            <div key={index} className='pizzasOrdered'>
              {/* Show pizza name and total quantity ONCE */}
              <div className='flexRow'>
                <p className='space'>{pizzaTitles[pizzaName] || pizzaName}:</p>
                <p>{pizzaData.quantity} </p>
              </div>    
              {(() => {
                const totalOrdered = pizzaData.quantity;
                const batchesUsed = pizzaData.batchesUsed;
                const selectedBatches = batchesUsed.filter(b => b.batch_number);
                const totalAssigned = selectedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
                let errorType = null;
                if (selectedBatches.length === 0) {
                  errorType = "missing";
                } else if (!isSplitChecked) {
                  const batch = batches.find(b => b.batch_code === selectedBatches[0]?.batch_number);
                  const available = getAvailableQuantity(batch, pizzaName, selectedOrder.id);
                  if (available < totalOrdered) {
                    errorType = "understock";
                  }
                } else {
                  const anyOverused = selectedBatches.some(b => {
                    const batch = batches.find(batch => batch.batch_code === b.batch_number);
                    return batch && b.quantity > getAvailableQuantity(batch, pizzaName, selectedOrder.id);
                  });
                  if (anyOverused) {
                    errorType = "overuse";
                  } else if (totalAssigned !== totalOrdered) {
                    errorType = "mismatch";
                  }
                }
                const errorMessages = {
                  missing: "*Select a batch",
                  understock: "*Not enough available in selected batch",
                  mismatch: "*Split quantities don’t match order",
                  overuse: "*One or more split batches exceed available stock"
                };
                return errorType ? <p className="tbc">{errorMessages[errorType]}</p> : null;
              })()}



              <div className="batchButtonContainer">
              {batches
                .filter(batch => {
                  const pizza = batch.pizzas.find(p => p.id === pizzaName);
                  return (
                    pizza &&
                    getAvailableQuantity(batch, pizzaName, selectedOrder.id) > 0 &&
                    batch.pizza_numbers_complete === true
                  );
                })
                .map((batch, i) => {
                  const isSelected = pizzaData.batchesUsed.some(b => b.batch_number === batch.batch_code);
                  const selectedBatch = pizzaData.batchesUsed.find(b => b.batch_number === batch.batch_code);
                  const available = getAvailableQuantity(batch, pizzaName, selectedOrder.id);
                  const quantity = selectedBatch?.quantity || 0;
                  const hasSelection = pizzaData.batchesUsed.some(b => !!b.batch_number);

                  return (
                    <div
                      key={i}
                      className={`batchButton 
                        ${isSelected ? 'selected' : ''} 
                        ${!isSplitChecked && hasSelection && !isSelected ? 'faded' : ''}`}
                      onClick={() => handleBatchClick(pizzaName, batch.batch_code)}
                    >
                      <div className="batchLabel">
                        {batch.batch_code} <br /> ({available} available)
                      </div>

                      {isSplitChecked && isSelected && (
                        <input
                          type="number"
                          min={0}
                          max={available}
                          value={quantity === 0 ? "" : quantity}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            handleBatchQuantityChange(pizzaName, batch.batch_code, isNaN(val) ? 0 : val);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            </div>
          ))}

            <p><strong>Total Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
            <p><strong>Order Status: </strong> {selectedOrder.order_status}</p>
          </div>
          <div>
            <button className='button' onClick={handlePrintClick}>
              <FontAwesomeIcon icon={faPrint} className='icon' /> Packing Slip
            </button>
            {!selectedOrder.complete && selectedOrder.order_status !== "order placed" && (
              <button
                className='button'
                onClick={
                  selectedOrder.order_status === "ready to pack"
                    ? () => markSelectedAsPacked([selectedOrder.id]) // Pass single ID
                    : handleComplete
                }
              >
                {selectedOrder.order_status === "ready to pack" ? "Mark as Packed" : "Order Complete"}
              </button>
            )}
          </div>
        </div>
        </div>
      )}
  </div>
  )
}

export default Orders;