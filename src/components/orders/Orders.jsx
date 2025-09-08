// import berthasLogo from './bertha_logo'
import './orders.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, getDoc, doc, updateDoc, writeBatch, deleteDoc } from '@firebase/firestore';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {faPrint, faPencilAlt, faTrash, faSort} from '@fortawesome/free-solid-svg-icons';
import { formatDate, formatDeliveryDay } from '../../utils/formatDate';
import { fetchCustomerByAccountID } from '../../utils/firestoreUtils';
import { onSnapshot } from 'firebase/firestore';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function Orders() {
  //make an orders array
  const [orders, setOrders] = useState ([])
  const [viewModal, setViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pizzaTitles, setPizzaTitles] = useState({});
  const [batches, setBatches] = useState({});
  // inline edits
  const [editingDeliveryDate, setEditingDeliveryDate] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [draftQuantities, setDraftQuantities] = useState({});
  // 
  const modalRef = useRef(null)
  const [customerInfo, setCustomerInfo] = useState(null);
  const [allCustomers, setAllCustomers] = useState({})
  // select mode on the orders
  const [selectMode, setSelectMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [batchErrors, setBatchErrors] = useState({});
  const [isSplitChecked, setIsSplitChecked] = useState(false);
  const [editQuantities, setEditQuantities] = useState(false);
  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 20;
  // sort filter
  const [sortField, setSortField] = useState("order_status");
  const [sortDirection, setSortDirection] = useState("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const STATUS_ORDER = ["order placed", "ready to pack", "packed", "complete"];
  const [lastCheckedIndex, setLastCheckedIndex] = useState(null);
  const [packingHtml, setPackingHtml] = useState('');
  const [draftBatchQuantities, setDraftBatchQuantities] = useState({});
  const [splitToggleError, setSplitToggleError] = useState("");

  // format batchcode into a date as it appears on the sleeves
const formatBatchCode = (code) => {
  const parsed = dayjs(code, 'YYYYMMDD', true);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : code;
};


// recalc totals if quantities are altered
function calculatePizzaTotal(pizzas) {
  return Object.values(pizzas).reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
}




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
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === "order_status") {
      // Use reversed status order if descending
      const statusOrder = sortDirection === "asc"
        ? STATUS_ORDER
        : [...STATUS_ORDER].reverse();
      const statusA = statusOrder.indexOf(a.order_status);
      const statusB = statusOrder.indexOf(b.order_status);
      if (statusA !== statusB) return statusA - statusB;

      // Within status, sort by delivery_day ("tbc" at the top)
      const aDate = a.delivery_day === 'tbc' ? null : new Date(a.delivery_day);
      const bDate = b.delivery_day === 'tbc' ? null : new Date(b.delivery_day);
      if (!aDate && !bDate) return 0;
      if (!aDate) return -1;
      if (!bDate) return 1;
      return  bDate - aDate;
    }

    // Special handling for delivery_day (tbc at top)
    if (sortField === "delivery_day") {
      const aDate = aValue === 'tbc' ? null : new Date(aValue);
      const bDate = bValue === 'tbc' ? null : new Date(bValue);
      if (!aDate && !bDate) return 0;
      if (!aDate) return -1;
      if (!bDate) return 1;
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    }
    // For pizzaTotal, ensure numeric sort
    if (sortField === "pizzaTotal") {
      aValue = Number(aValue) || 0;
      bValue = Number(bValue) || 0;
    }
    // Special handling for region (look up from allCustomers)
    if (sortField === "region") {
      aValue = allCustomers[a.account_ID]?.delivery_region || "";
      bValue = allCustomers[b.account_ID]?.delivery_region || "";
    }

    // Default string/numeric sort
    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
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

  if (newQuantity === 0) {
    // Remove batch allocation from local state
    batches.splice(index, 1);
    order.pizzas[pizzaId].batchesUsed = batches;
    setSelectedOrder(order);
    updateOrderInList(order.id, { pizzas: order.pizzas }); // <-- Add this line

    // Remove allocation from Firestore
    await removePizzaAllocationFromBatch({ pizzaId, batchCode });

    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        [`pizzas.${pizzaId}.batchesUsed`]: batches,
      });
    } catch (error) {
      console.error("Error removing batch allocation in Firestore:", error);
    }

    validateAndUpdateOrderStatus(order);
    return;
  }

  // Update the changed batch's quantity
  batches[index].quantity = newQuantity;
  order.pizzas[pizzaId].batchesUsed = batches;
  setSelectedOrder(order);
  updateOrderInList(order.id, { pizzas: order.pizzas }); // <-- Add this line

  // Update the allocation in the batch
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

  validateAndUpdateOrderStatus(order);
};




const removePizzaAllocationFromBatch = async ({ pizzaId, batchCode }) => {
  const batchDoc = batches.find(b => b.batch_code === batchCode);
  if (!batchDoc) return;
  const allocations = batchDoc.pizza_allocations || [];
  const orderId = selectedOrder.id;
  const filtered = allocations.filter(
    a => !(a.orderId === orderId && a.pizzaId === pizzaId)
  );
  try {
    await updateDoc(doc(db, "batches", batchDoc.id), {
      pizza_allocations: filtered
    });
  } catch (error) {
    console.error("Error removing pizza allocation:", error);
  }
};


// delete order?
const handleOrderDelete = async () => {
  if (!selectedOrder) return;
  const pizzaTotal = selectedOrder.pizzaTotal || 0;
  const confirmDelete = window.confirm(
    `Are you sure you want to delete ${selectedOrder.customer_name} ${selectedOrder.sample_customer_name|| ''}: ${pizzaTotal} pizzas?`
  );
  if (!confirmDelete) return;

  try {
    // Delete the order
    await deleteDoc(doc(db, "orders", selectedOrder.id));
    // Remove allocations for this order in all batches
    const batchesSnapshot = await getDocs(collection(db, "batches"));
    const batchDocs = batchesSnapshot.docs;
    const allocationUpdates = batchDocs.map(async (docSnap) => {
      const batchData = docSnap.data();
      const filteredAllocations = (batchData.pizza_allocations || []).filter(
        allocation => allocation.orderId !== selectedOrder.id
      );
      if (filteredAllocations.length !== (batchData.pizza_allocations || []).length) {
        await updateDoc(doc(db, "batches", docSnap.id), {
          pizza_allocations: filteredAllocations
        });
      }
    });
    await Promise.all(allocationUpdates);
    setSelectedOrder(null);
    setViewModal(false);
    fetchOrdersAgain();
  } catch (error) {
    alert("Error deleting order: " + error.message);
    console.error("Error deleting order:", error);
  }
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


    // revert order status
    const updateOrderStatus = async (orderId, newStatus) => {
      try {
        await updateDoc(doc(db, "orders", orderId), {
          order_status: newStatus,
          complete: newStatus === "complete"
        });
      } catch (error) {
        alert("Failed to update order status: " + error.message);
      }
    };

    // mark bulk orders as packed
    const markSelectedAsPacked = async (orderIds = selectedOrders) => {
      try {
        console.log(orderIds)
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

    // mark selected orders as complete
    const markSelectedAsComplete = async (orderIds = selectedOrders) => {
      try {
        const batch = writeBatch(db);

        // Update order docs
        orderIds.forEach(orderId => {
          const orderRef = doc(db, "orders", orderId);
          batch.update(orderRef, { order_status: "complete", complete: true });
        });

        await batch.commit();

        // Now update allocations in all batches for these orders
        const batchesSnapshot = await getDocs(collection(db, "batches"));
        const batchDocs = batchesSnapshot.docs;

        const allocationUpdates = batchDocs.map(async (docSnap) => {
          const batchData = docSnap.data();
          let updated = false;

          const updatedAllocations = (batchData.pizza_allocations || []).map(allocation => {
            if (orderIds.includes(allocation.orderId)) {
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

        await Promise.all(allocationUpdates);

        fetchOrdersAgain();
        setSelectedOrders([]);
        setSelectMode(false);
      } catch (error) {
        console.error("❌ Error marking orders as complete:", error);
      }
    };

    const updateOrderInList = (orderId, updates) => {
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, ...updates } : order
        )
      );
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
      // Assign quantity 1 to new batch in split mode
      newBatches = [...currentBatches, { batch_number: batchCode, quantity: 1 }];
      newQuantity = 1;
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
    for (const b of currentBatches) {
      if (b.batch_number !== batchCode) {
        await removePizzaAllocationFromBatch({ pizzaId: pizzaName, batchCode: b.batch_number });
      }
    }
    await syncPizzaAllocation({
      pizzaId: pizzaName,
      batchCode,
      quantity: newQuantity
    });
    } catch (error) {
      console.error("Error updating batch assignment:", error);
    }
    if (!selectedOrder.complete) {
      validateAndUpdateOrderStatus(updatedOrder);
    }
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

  // handle sorting orders
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
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

  const filteredOrders = orders.filter(order => {
  const customer = allCustomers[order.account_ID] || {};
  const search = searchTerm.toLowerCase();

    // Format delivery day for searching
  let formattedDeliveryDay = "";
  if (order.delivery_day && order.delivery_day !== "tbc") {
    formattedDeliveryDay = dayjs(order.delivery_day).format("DD/MM/YYYY");
  }
    // Normalize for flexible search
  const normalize = str => str.replace(/[\s\-\/\.]/g, '').toLowerCase();

  const deliveryDayVariants = [
    order.delivery_day || "",
    formattedDeliveryDay,
    dayjs(order.delivery_day).format("DD.MM.YYYY"),
    dayjs(order.delivery_day).format("DD-MM-YYYY"),
    dayjs(order.delivery_day).format("YYYY-MM-DD"),
    dayjs(order.delivery_day).format("YYYY/MM/DD"),
    dayjs(order.delivery_day).format("YYYY.MM.DD"),
  ];

  const matchesDeliveryDay = deliveryDayVariants.some(variant =>
    normalize(variant).includes(normalize(search))
  );
    return (
      order.customer_name?.toLowerCase().includes(search) ||
      order.sample_customer_name?.toLowerCase().includes(search) ||
      order.order_status?.toLowerCase().includes(search) ||
      matchesDeliveryDay ||
      customer.delivery_region?.toLowerCase().includes(search) ||
      order.account_ID?.toLowerCase().includes(search)
    );
  });
  const sortedOrders = sortOrders(filteredOrders);
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
      let customerName;
      if (order.customer_name === 'SAMPLES' && order.sample_customer_name) {
        customerName = `SAMPLE: ${order.sample_customer_name}`;
      } else if (order.customer_name === 'Weddings & Private Events' && order.sample_customer_name) {
        customerName = `Wedding/Event: ${order.sample_customer_name}`;
      } else {
        customerName = order.customer_name || order.account_ID;
      }
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
  const po = order.purchase_order || '—';
  const date = formatDeliveryDay(order.delivery_day);

  const customerData = allCustomers[order.account_ID] || {};

  let customerName;
  if (order.customer_name === 'SAMPLES' && order.sample_customer_name) {
    customerName = `SAMPLE: ${order.sample_customer_name}`;
  } else if (order.customer_name === 'Weddings & Private Events' && order.sample_customer_name) {
    customerName = `Wedding/Event: ${order.sample_customer_name}`;
  } else {
    customerName = customerData.name || order.customer_name || order.account_ID;
  }

  const address = [
    customerName,
    customerData.name_number,
    customerData.street,
    customerData.city,
    customerData.postcode,
    'GBR'
  ].filter(Boolean).join('<br/>');

  let html = `
  <div style="page-break-after: always; font-family: Arial, sans-serif; font-size: 14px; padding: 40px; max-width: 700px; margin: auto;">

  <div style=" margin-bottom: 20px;">
  <img src="/bertha_logo_bw.png" style="max-height: 80px;" />
  </div>
  
  <h2 style="text-align: center; margin-bottom: 30px;">PACKING SLIP</h2>
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
        <strong>Delivery Date:</strong> ${date}<br/>
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

    printWindow.onload = () => {
    const logoImg = printWindow.document.querySelector('img');
    
    if (logoImg) {
      logoImg.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };
      // Fallback in case onload never fires (e.g., cached images)
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 1000);
    } else {
      // No image? Just print
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };
};


const handleBulkPrintPackingSlips = () => {
  const selected = orders.filter(o => selectedOrders.includes(o.id));

  let html = `<html><head><title>Packing Slips</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .packing-slip { page-break-after: always; font-size: 14px; padding: 40px; max-width: 700px; margin: auto; }
      .packing-slip img { max-height: 80px; }
      table { width:100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 6px 0; }
      thead { border-bottom: 2px solid #000; }
    </style>
    </head><body>`;

  selected.forEach(order => {
    const po = order.purchase_order || '—';
    const date = formatDeliveryDay(order.delivery_day);
    const customerData = allCustomers[order.account_ID] || {};

    let customerName;
    if (order.customer_name === 'SAMPLES' && order.sample_customer_name) {
      customerName = `SAMPLE: ${order.sample_customer_name}`;
    } else if (order.customer_name === 'Weddings & Private Events' && order.sample_customer_name) {
      customerName = `Wedding/Event: ${order.sample_customer_name}`;
    } else {
      customerName = customerData.name || order.customer_name || order.account_ID;
    }

    const address = [
      customerName,
      customerData.name_number,
      customerData.street,
      customerData.city,
      customerData.postcode,
      'GBR'
    ].filter(Boolean).join('<br/>');

    html += `
      <div class="packing-slip">
        <div style="margin-bottom: 20px;">
          <img src="/bertha_logo_bw.png" />
        </div>
        <h2 style="text-align: center; margin-bottom: 30px;">PACKING SLIP</h2>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div style="border: 1px solid #000; padding: 10px; width: 48%;">
            <strong>Deliver to</strong><br/>
            ${address}
          </div>
          <div style="padding: 10px; width: 48%;">
            <strong>Bill to</strong><br/>
            ${address}
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div style="margin-bottom: 20px;">
            <strong>Delivery Date:</strong> ${date}<br/>
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
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>`;

    Object.entries(order.pizzas).forEach(([pizzaId, pizzaData]) => {
      const pizzaName = pizzaTitles[pizzaId] || pizzaId;
      pizzaData.batchesUsed.forEach(b => {
        const batchDate = formatBatchDate(b.batch_number);
        const quantity = parseFloat(b.quantity || 0).toFixed(2);
        html += `
            <tr>
              <td>${pizzaName} ${batchDate}</td>
              <td>${quantity}</td>
            </tr>`;
      });
    });

    html += `
          </tbody>
        </table>
      </div>`;
  });

  html += `</body></html>`;

  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

useEffect(() => {
  if (!selectedOrder) return;
  // Only turn on if any pizza has more than one batch with quantity > 0
  const hasSplit = Object.values(selectedOrder.pizzas || {}).some(
    pizza =>
      Array.isArray(pizza.batchesUsed) &&
      pizza.batchesUsed.filter(b => b.batch_number && Number(b.quantity) > 0).length > 1
  );
  setIsSplitChecked(hasSplit);
}, [selectedOrder]);

function getAllocatedTally(order) {
  if (!order || !order.pizzas) return { allocated: 0, total: 0 };
  let allocated = 0;
  let total = 0;
  Object.values(order.pizzas).forEach(pizza => {
    total += Number(pizza.quantity) || 0;
    // Sum all batch allocations for this pizza
    if (Array.isArray(pizza.batchesUsed)) {
      allocated += pizza.batchesUsed.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    }
  });
  return { allocated, total };
}

function getPizzaAllocatedTally(pizzaData) {
  const total = Number(pizzaData.quantity) || 0;
  let allocated = 0;
  if (Array.isArray(pizzaData.batchesUsed)) {
    allocated = pizzaData.batchesUsed.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }
  return { allocated, total };
}

  return (
  <div className='orders navContent'>
    <h2>ORDERS</h2>
    <div className='today'><span className='deliveryToday'>Today: {dayjs().format('DD/MM/YYYY').replace(/\//g, '-')}</span></div>
    <div className='selectOrdersAndSearchOrders'>
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
      <input
        type="text"
        placeholder="Search orders..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginRight: 8 }}
      />
      {selectedOrders.length > 0 && (
        <div className="bulk-actions">
          {/* generate Packing list button */}
          <button className="button" onClick={generatePDF}>
            Generate Packing List
          </button>
          {/* generate Packing Packing Slips */}
          <button className="button" onClick={handleBulkPrintPackingSlips}>
            Generate Packing Slips
          </button>
          {/* mark as packed */}
          <button className="button" onClick={() => markSelectedAsPacked()}>
            Mark as Packed
          </button>
          {/* mark as complete */}
          <button className="button" onClick={() => markSelectedAsComplete()}>
            Mark as complete
          </button>
        </div>
      )}

    </div>

    <div className='ordersList'>
      <div className='orderButton' id='totals'>
        <div className='orderHeadersAndFilters'>
          <div className='orderHeader'>Account:</div>
          <div className='filter' onClick={() => handleSort("customer_name")}>
            <FontAwesomeIcon icon={faSort} />
            {sortField === "customer_name" && (sortDirection === "asc" ? "▲" : "▼")}
          </div>
        </div>
        <div className='orderHeadersAndFilters'>
          <div className='orderHeader'>No. of Pizzas:</div>
          <div className='filter' onClick={() => handleSort("pizzaTotal")}>
            <FontAwesomeIcon icon={faSort} />
            {sortField === "pizzaTotal" && (sortDirection === "asc" ? "▲" : "▼")}
          </div>
        </div>
        <div className='orderHeadersAndFilters  orderStatus'>
          <div className='orderHeader'>Order Status:</div>
          <div className='filter' onClick={() => handleSort("order_status")}>
            <FontAwesomeIcon icon={faSort} />
            {sortField === "order_status" && (sortDirection === "asc" ? "▲" : "▼")}
          </div>
        </div>
        <div className='orderHeadersAndFilters'>
          <div className='orderHeader'>Delivery Day:</div>
          <div className='filter' onClick={() => handleSort("delivery_day")}>
            <FontAwesomeIcon icon={faSort} />
            {sortField === "delivery_day" && (sortDirection === "asc" ? "▲" : "▼")}
          </div>
        </div>
        <div className='orderHeadersAndFilters  region'>
          <div className='orderHeader'>Region:</div>
          <div className='filter' onClick={() => handleSort("region")}>
            <FontAwesomeIcon icon={faSort}/>
            {sortField === "region" && (sortDirection === "asc" ? "▲" : "▼")}
          </div>
        </div>
      </div>

    {orders.length > 0 ? (
      
      currentOrders.map(order => { 
        const isToday =
          order.delivery_day &&
          order.delivery_day !== 'tbc' &&
          dayjs(order.delivery_day).isSame(dayjs(), 'day');
        
        const orderCustomer = allCustomers[order.account_ID];
      return(
          <div className="orderRow" key={order.id}>
            {selectMode && (
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={e => {
                    const orderIndex = currentOrders.findIndex(o => o.id === order.id);
                    if (e.nativeEvent.shiftKey && lastCheckedIndex !== null) {
                      // Shift is held: select range
                      const start = Math.min(lastCheckedIndex, orderIndex);
                      const end = Math.max(lastCheckedIndex, orderIndex);
                      const idsInRange = currentOrders.slice(start, end + 1).map(o => o.id);
                      setSelectedOrders(prev => {
                        // Add all in range if not all selected, else remove all in range
                        const allSelected = idsInRange.every(id => prev.includes(id));
                        if (allSelected) {
                          return prev.filter(id => !idsInRange.includes(id));
                        } else {
                          return Array.from(new Set([...prev, ...idsInRange]));
                        }
                      });
                    } else {
                      // Normal click
                      setSelectedOrders(prev =>
                        prev.includes(order.id)
                          ? prev.filter(id => id !== order.id)
                          : [...prev, order.id]
                      );
                      setLastCheckedIndex(orderIndex);
                    }
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
            <div>{order.customer_name === 'SAMPLES' ? `SAMPLE: ${order.sample_customer_name}` :  order.customer_name === 'Weddings & Private Events' ? `Wedding/Event: ${order.sample_customer_name}`: order.customer_name}</div>
            <div>{order.pizzaTotal}</div>
            <div className='orderStatus'>{order.order_status}</div>
            <div
              className={`
                ${order.delivery_day === 'tbc' ? 'tbc' : ''}
                `
              }
            >
              <span className={isToday ? 'deliveryToday' : ''}>

              {order.delivery_day === 'tbc'
                ? 'tbc'
                : formatDeliveryDay(order.delivery_day)}
                </span>
            </div>
            <div className='region'>{orderCustomer?.delivery_region || '—'}</div>
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
          <div className='orderDetailsAndSlip'>
            <div>- Order Details -</div>
            <button className='button packButton' onClick={handlePrintClick}>
              <FontAwesomeIcon icon={faPrint} className='icon' /> Packing Slip
            </button>
          </div>
          <div className='orderContent'>
            <p><strong>Account ID:</strong> {selectedOrder.account_ID}</p>
            <p><strong>Customer:  </strong> {selectedOrder.customer_name === 'SAMPLES' ? `SAMPLE: ${selectedOrder. sample_customer_name}` :  selectedOrder.customer_name === 'Weddings & Private Events' ? `Wedding/Event: ${selectedOrder.sample_customer_name}`: selectedOrder.customer_name}</p>

            {selectedOrder.account_ID !== "SAMPLES/6UGM" && selectedOrder.account_ID !== "WEDDINGSPRIVATEEVENTS" &&
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
            }
            <p><strong>Email: </strong>
              {editingEmail ? (
                <input
                  type="email"
                  value={emailInput}
                  autoFocus
                  onChange={e => setEmailInput(e.target.value)}
                  onBlur={async () => {
                    await updateDoc(doc(db, "orders", selectedOrder.id), {
                      email: emailInput
                    });
                    setSelectedOrder(prev => ({
                      ...prev,
                      email: emailInput
                    }));
                    setEditingEmail(false);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await updateDoc(doc(db, "orders", selectedOrder.id), {
                        email: emailInput
                      });
                      setSelectedOrder(prev => ({
                        ...prev,
                        email: emailInput
                      }));
                      setEditingEmail(false);
                    }
                  }}
                  style={{ width: 250 }}
                />
              ) : (
                <span
                  className="clickable"
                  onClick={() => {
                    setEmailInput(selectedOrder.email || '');
                    setEditingEmail(true);
                  }}
                >
                  {selectedOrder.email || 'N/A'}
                </span>
              )}
            </p>

            <p><strong>Order Placed: </strong> {formatDate(selectedOrder.timestamp)}</p>

            <p><strong>Delivery Notes: </strong>
              {editingNotes ? (
                <input
                  type="text"
                  value={notesInput}
                  autoFocus
                  onChange={e => setNotesInput(e.target.value)}
                  onBlur={async () => {
                    await updateDoc(doc(db, "orders", selectedOrder.id), {
                      additional_notes: notesInput
                    });
                    setSelectedOrder(prev => ({
                      ...prev,
                      additional_notes: notesInput
                    }));
                    setEditingNotes(false);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await updateDoc(doc(db, "orders", selectedOrder.id), {
                        additional_notes: notesInput
                      });
                      setSelectedOrder(prev => ({
                        ...prev,
                        additional_notes: notesInput
                      }));
                      setEditingNotes(false);
                    }
                  }}
                  style={{ width: 250 }}
                />
              ) : (
                <span
                  className="clickable"
                  onClick={() => {
                    setNotesInput(selectedOrder.additional_notes || '');
                    setEditingNotes(true);
                  }}
                >
                  {selectedOrder.additional_notes || 'N/A'}
                </span>
              )}
            </p>

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
                className="clickable"
                onClick={() => {
                  setEditingDeliveryDate(true);
                  setDeliveryDateInput(selectedOrder.delivery_day || '');
                }}
              >
                <div className={`${selectedOrder.delivery_day === 'tbc' ? 'tbc' : ''}`}>
                  {selectedOrder.delivery_day === 'tbc' || !selectedOrder.delivery_day
                    ? 'select day'
                    : formatDeliveryDay(selectedOrder.delivery_day)}
                </div>
              </span>
            )}
          </div>
            <div className='split'>
            <strong>Pizzas Ordered:</strong>
              <FontAwesomeIcon
                icon={faPencilAlt}
                className="icon clickable"
                title="Edit quantities"
                style={{ marginLeft: 8 }}
                onClick={() => setEditQuantities(q => !q)}
              />
              <div
                style={{ display: "inline-block" }}
                onClick={e => {
                  const isDisabled = Object.values(selectedOrder.pizzas || {}).some(
                    pizza =>
                      Array.isArray(pizza.batchesUsed) &&
                      pizza.batchesUsed.filter(b => b.batch_number && Number(b.quantity) > 0).length > 1
                  );
                  if (isDisabled) {
                    setSplitToggleError("*toggle disabled on already split batches");
                    e.preventDefault();
                    e.stopPropagation();
                  } else {
                    setSplitToggleError("");
                  }
                }}
              >
                <label className="switch" title='fulfil with multiple batch codes?'>
                  <input 
                    type="checkbox"
                    checked={isSplitChecked}
                    disabled={
                      Object.values(selectedOrder.pizzas || {}).some(
                        pizza =>
                          Array.isArray(pizza.batchesUsed) &&
                          pizza.batchesUsed.filter(b => b.batch_number && Number(b.quantity) > 0).length > 1
                      )
                    }
                    onChange={e => setIsSplitChecked(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
              {splitToggleError && (
                <div className="tbc toggleError">
                  {splitToggleError}
                </div>
              )}
            {Object.entries(selectedOrder.pizzas)
              .sort(([a], [b]) => {
                const nameA = pizzaTitles[a] || a;
                const nameB = pizzaTitles[b] || b;
                return nameA.localeCompare(nameB);
              })
              .map(([pizzaName, pizzaData], index) => (
            <div key={index} className='pizzasOrdered'>
              {/* Show pizza name and total quantity ONCE */}
              <div className='flexRow'>
                <p className='space'>{pizzaTitles[pizzaName] || pizzaName}:</p>
                {editQuantities ? (
                  <input
                    type="number"
                    min={1}
                    value={draftQuantities[pizzaName] ?? pizzaData.quantity}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setDraftQuantities(prev => ({ ...prev, [pizzaName]: val }));
                    }}
                    onBlur={async () => {
                      const newQty = draftQuantities[pizzaName] ?? pizzaData.quantity;
                      // Update order in Firestore
                      await updateDoc(doc(db, "orders", selectedOrder.id), {
                        [`pizzas.${pizzaName}.quantity`]: newQty,
                        pizzaTotal: calculatePizzaTotal({
                          ...selectedOrder.pizzas,
                          [pizzaName]: { ...pizzaData, quantity: newQty }
                        }),
                      });
                      // Update local state
                      setSelectedOrder(prev => ({
                        ...prev,
                        pizzas: {
                          ...prev.pizzas,
                          [pizzaName]: {
                            ...prev.pizzas[pizzaName],
                            quantity: newQty,
                          }
                        },
                        pizzaTotal: calculatePizzaTotal({
                          ...prev.pizzas,
                          [pizzaName]: { ...prev.pizzas[pizzaName], quantity: newQty }
                        }),
                      }));
                      // Now update batch allocations for all assigned batches
                      const batchesUsed = selectedOrder.pizzas[pizzaName].batchesUsed || [];
                      for (const batch of batchesUsed) {
                        await syncPizzaAllocation({
                          pizzaId: pizzaName,
                          batchCode: batch.batch_number,
                          quantity: isSplitChecked ? batch.quantity : newQty
                        });
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") e.target.blur();
                    }}
                    style={{ width: 60 }}
                  />
                ) : (
                  <p>allocated {getPizzaAllocatedTally(pizzaData).allocated}/{pizzaData.quantity}
                  </p>
                )}
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
                .sort((a, b) => a.batch_code.localeCompare(b.batch_code))
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
                        {formatBatchCode(batch.batch_code)} <br /> ({available} available)
                      </div>

                      {isSplitChecked && isSelected && (
                        <input
                          type="number"
                          min={0}
                          max={available}
                          value={
                            draftBatchQuantities[`${pizzaName}_${batch.batch_code}`] !== undefined
                              ? draftBatchQuantities[`${pizzaName}_${batch.batch_code}`]
                              : (quantity === 0 ? "" : quantity)
                          }
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const val = e.target.value;
                            setDraftBatchQuantities(prev => ({
                              ...prev,
                              [`${pizzaName}_${batch.batch_code}`]: val
                            }));
                          }}
                          onBlur={e => {
                            const val = parseInt(e.target.value, 10);
                            handleBatchQuantityChange(
                              pizzaName,
                              batch.batch_code,
                              isNaN(val) ? 0 : val
                            );
                            setDraftBatchQuantities(prev => {
                              const updated = { ...prev };
                              delete updated[`${pizzaName}_${batch.batch_code}`];
                              return updated;
                            });
                          }}
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            </div>
          ))}
          {editQuantities && (() => {
            //pizza IDs for customer's default view
            const allPossiblePizzas = Object.keys(pizzaTitles).filter(id => {
              if (customerInfo?.default_pizza_view === "withSleeve") return id.endsWith("1");
              if (customerInfo?.default_pizza_view === "noSleeve") return id.endsWith("0");
              return true;
            });
            const pizzasInOrder = Object.keys(selectedOrder.pizzas);
            const missingPizzas = allPossiblePizzas.filter(id => !pizzasInOrder.includes(id));

            if (missingPizzas.length === 0) return null;
            return (
              <div className="missingPizzas">
                {missingPizzas.map((pizzaId) => (
                  <div key={pizzaId} className="flexRow">
                    <p className="space">{pizzaTitles[pizzaId] || pizzaId}:</p>
                    <input
                      type="number"
                      min={0}
                      value={0}
                      onChange={async (e) => {
                        const newQty = parseInt(e.target.value, 10) || 0;
                        if (!pizzaData.original_quantity) {
                          await updateDoc(doc(db, "orders", selectedOrder.id), {
                            [`pizzas.${pizzaName}.original_quantity`]: pizzaData.quantity,
                          });
                        }
                        const updatedPizzas = {
                          ...selectedOrder.pizzas,
                          [pizzaName]: {
                            ...selectedOrder.pizzas[pizzaName],
                            quantity: newQty,
                            original_quantity: pizzaData.original_quantity || pizzaData.quantity,
                          }
                        };
                        const newPizzaTotal = calculatePizzaTotal(updatedPizzas);
                        await updateDoc(doc(db, "orders", selectedOrder.id), {
                          [`pizzas.${pizzaName}.quantity`]: newQty,
                          pizzaTotal: newPizzaTotal,
                        });
                        // Update local state
                        setSelectedOrder(prev => ({
                          ...prev,
                          pizzas: {
                            ...prev.pizzas,
                            [pizzaName]: {
                              ...prev.pizzas[pizzaName],
                              quantity: newQty,
                              original_quantity: prev.pizzas[pizzaName].original_quantity || prev.pizzas[pizzaName].quantity,
                            }
                          },
                          pizzaTotal: newPizzaTotal,
                        }));

                        // --- Sync allocation(s) ---
                        const batchesUsed = pizzaData.batchesUsed || [];
                        if (batchesUsed.length > 0) {
                          for (const batch of batchesUsed) {
                            await syncPizzaAllocation({
                              pizzaId: pizzaName,
                              batchCode: batch.batch_number,
                              quantity: isSplitChecked ? batch.quantity : newQty
                            });
                          }
                        }
                      }}
                      style={{ width: 60 }}
                    />
                  </div>
                ))}
              </div>
            );
          })()}

            <p><strong>Total Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
            <p><strong>Order Status: </strong> {selectedOrder.order_status}</p>
          </div>
          <div className='modalFooter'>
            <div>
            
            {!selectedOrder.complete && selectedOrder.order_status !== "order placed" && (
            <button
              className="button"
              onClick={
                selectedOrder.order_status === "ready to pack"
                  ? () => {
                      markSelectedAsPacked([selectedOrder.id]); 
                      setSelectedOrder(prev => ({
                        ...prev,
                        order_status: "packed" 
                      }));
                    }
                  : handleComplete
              }
            >
              {selectedOrder.order_status === "ready to pack" ? "Mark as Packed" : "Order Complete"}
            </button>
          )}
          {selectedOrder.order_status === "packed" && !selectedOrder.complete && (
            <button
              className="button button-secondary"
              onClick={() => {
                // Revert to "ready to pack"
                updateOrderStatus(selectedOrder.id, "ready to pack");
                setSelectedOrder(prev => ({
                  ...prev,
                  order_status: "ready to pack"
                }));
                updateOrderInList(selectedOrder.id, { order_status: "ready to pack", complete: false });
              }}
            >
              Revert to "Ready to Pack"
            </button>
          )}

          {selectedOrder.order_status === "complete" && (
            <button
              className="button button-secondary"
              onClick={async () => {
                // Revert to "packed"
                await updateOrderStatus(selectedOrder.id, "packed");
                setSelectedOrder(prev => ({
                  ...prev,
                  order_status: "packed",
                  complete: false
                }));
                updateOrderInList(selectedOrder.id, { order_status: "packed", complete: false });
                // Remove allocation status for this order in all batches
                const batchesSnapshot = await getDocs(collection(db, "batches"));
                const batchDocs = batchesSnapshot.docs;
                const allocationUpdates = batchDocs.map(async (docSnap) => {
                  const batchData = docSnap.data();
                  let updated = false;
                  const updatedAllocations = (batchData.pizza_allocations || []).map(allocation => {
                    if (allocation.orderId === selectedOrder.id && allocation.status === "completed") {
                      updated = true;
                      // Remove the status property
                      const { status, ...rest } = allocation;
                      return rest;
                    }
                    return allocation;
                  });

                  if (updated) {
                    await updateDoc(doc(db, "batches", docSnap.id), {
                      pizza_allocations: updatedAllocations
                    });
                  }
                });

                await Promise.all(allocationUpdates);
              }}
            >
              Revert to "Packed"
            </button>
          )}
          </div>
          <button 
            className='button'
            onClick={handleOrderDelete}
          >
            <FontAwesomeIcon icon = {faTrash}/>
          </button>

          </div>
        </div>
        </div>
      )}
  </div>
  )
}

export default Orders;