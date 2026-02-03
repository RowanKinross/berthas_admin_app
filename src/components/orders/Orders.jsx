// import berthasLogo from './bertha_logo'
import './orders.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, getDoc, doc, updateDoc, writeBatch, deleteDoc } from '@firebase/firestore';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {faPrint, faReceipt, faPencilAlt, faTrash, faSort, faArrowTurnUp, faArrowLeft, faList, faFileExport, faCheck, faCheckSquare, faBox, faBoxOpen, faDownload, faTimes} from '@fortawesome/free-solid-svg-icons';
import { formatDate, formatDeliveryDay } from '../../utils/formatDate';
import { fetchCustomerByAccountID } from '../../utils/firestoreUtils';
import { onSnapshot, deleteField } from 'firebase/firestore';
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
  
  // Press and hold selection state
  const [pressTimer, setPressTimer] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 25;
  // sort filter
  const [sortField, setSortField] = useState("order_status");
  const [sortDirection, setSortDirection] = useState("asc");
  const [searchTerm, setSearchTerm] = useState("");
  const STATUS_ORDER = ["order placed", "ready to pack", "packed", "complete"];
  const [lastCheckedIndex, setLastCheckedIndex] = useState(null);
  const [packingHtml, setPackingHtml] = useState('');
  const [draftBatchQuantities, setDraftBatchQuantities] = useState({});
  const [pizzaCatalog, setPizzaCatalog] = useState([]);
  
  // split toggle
  const [splitToggleError, setSplitToggleError] = useState("");
  const [showSplitHint, setShowSplitHint] = useState(() => 
    localStorage.getItem('hasSeenSplitInstruction') !== 'true'
  );
  
  // edit qty hint
  const [showEditQtyHint, setShowEditQtyHint] = useState(() => 
    localStorage.getItem('hasSeenEditQtyInstruction') !== 'true'
  );
  
  // tool tip on mobile for explaining the buttons
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Sleeve Filter:
  const [sleeveFilter, setSleeveFilter] = useState("all");

  // Found stock data
  const [foundStockData, setFoundStockData] = useState({});
  const [expandedFoundStock, setExpandedFoundStock] = useState({});

  // format batchcode into a date as it appears on the sleeves
const formatBatchCode = (code) => {
  const parsed = dayjs(code, 'YYYYMMDD', true);
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : code;
};


// recalc totals if quantities are altered
function calculatePizzaTotal(pizzas) {
  return Object.values(pizzas).reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
}


const MobileTooltip = ({ children, text, id }) => (
  <div 
    className="tooltip-wrapper"
    onTouchStart={() => setActiveTooltip(id)}
    onTouchEnd={() => setTimeout(() => setActiveTooltip(null), 2000)}
  >
    {children}
    {activeTooltip === id && (
      <div className="mobile-tooltip">{text}</div>
    )}
  </div>
);






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



useEffect(() => {
  const fetchPizzaCatalog = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "pizzas"));
      const catalog = [];
      const titlesMap = {};
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.id && data.pizza_title) {
          titlesMap[data.id] = data.pizza_title;
          catalog.push(data);
        }
      });
      setPizzaTitles(titlesMap);
      setPizzaCatalog(catalog);
    } catch (error) {
      console.error("Error fetching pizza catalog:", error);
    }
  };
  fetchPizzaCatalog();
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
    
    // Auto-validate order status when modal opens
    if (selectedOrder && !selectedOrder.complete) {
      // console.log("🚀 Modal opened for order:", selectedOrder.customer_name);
      validateAndUpdateOrderStatus(selectedOrder);
    }
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
  // If quantity is > 0, re-add it with status: "incomplete"
  if (quantity > 0) {
    filtered.push({ orderId, pizzaId, quantity, status: "incomplete" });
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

  // Found stock functions
  const toggleFoundStock = async (pizzaId) => {
    const isExpanded = expandedFoundStock[pizzaId];
    
    if (!isExpanded) {
      try {
        // Get all batches for this pizza type
        const allBatches = await getDocs(collection(db, "batches"));
        const nineMonthsAgo = dayjs().subtract(9, 'months');
        
        const pizzaBatches = allBatches.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(batch => {
            // Show all batches that contain this pizza type and are completed
            if (!batch.pizzas?.some(p => p.id === pizzaId) || batch.pizza_numbers_complete !== true) {
              return false;
            }
            
            // Filter by date - only show batches from last 9 months
            const batchDate = dayjs(batch.batch_code, 'DDMMYYYY');
            return batchDate.isValid() && batchDate.isAfter(nineMonthsAgo);
          })
          .sort((a, b) => b.batch_code.localeCompare(a.batch_code)); // newest first
        
        setFoundStockData(prev => ({ ...prev, [pizzaId]: pizzaBatches }));
      } catch (error) {
        console.error("Error fetching found stock:", error);
      }
    }
    
    setExpandedFoundStock(prev => ({ ...prev, [pizzaId]: !isExpanded }));
  };

  const updateBatchQuantity = async (batchId, pizzaId, change) => {
    try {
      const batchRef = doc(db, "batches", batchId);
      const batchDoc = await getDoc(batchRef);
      const batchData = batchDoc.data();
      
      const updatedPizzas = batchData.pizzas.map(pizza => {
        if (pizza.id === pizzaId) {
          return { ...pizza, quantity: Math.max(0, pizza.quantity + change) };
        }
        return pizza;
      });
      
      await updateDoc(batchRef, { pizzas: updatedPizzas });
      
      // Update local state for the specific pizza
      setFoundStockData(prev => ({
        ...prev,
        [pizzaId]: (prev[pizzaId] || []).map(batch => {
          if (batch.id === batchId) {
            return { ...batch, pizzas: updatedPizzas };
          }
          return batch;
        })
      }));
      
    } catch (error) {
      console.error("Error updating batch quantity:", error);
    }
  };

  const archivePizza = async (batchId, pizzaId) => {
    try {
      const batchRef = doc(db, "batches", batchId);
      const batchDoc = await getDoc(batchRef);
      const batchData = batchDoc.data();
      
      const updatedPizzas = batchData.pizzas.map(pizza => {
        if (pizza.id === pizzaId) {
          return { ...pizza, archived: true };
        }
        return pizza;
      });
      
      await updateDoc(batchRef, { pizzas: updatedPizzas });
      
      // Update local state
      setFoundStockData(prev => prev.map(batch => {
        if (batch.id === batchId) {
          return { ...batch, pizzas: updatedPizzas };
        }
        return batch;
      }));
      
    } catch (error) {
      console.error("Error archiving pizza:", error);
    }
  };

  const handleBatchClick = async (pizzaName, batchCode) => {
    const currentBatches = [...(selectedOrder.pizzas[pizzaName].batchesUsed || [])];
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

    // Remove allocations from batches that are no longer used
    for (const b of currentBatches) {
      if (!newBatches.some(nb => nb.batch_number === b.batch_number)) {
        await removePizzaAllocationFromBatch({ pizzaId: pizzaName, batchCode: b.batch_number });
      }
    }

    // Sync allocations for all batches in newBatches
    for (const b of newBatches) {
      await syncPizzaAllocation({
        pizzaId: pizzaName,
        batchCode: b.batch_number,
        quantity: b.quantity
      });
    }
  } catch (error) {
    console.error("Error updating batch assignment:", error);
  }
  if (!selectedOrder.complete) {
    validateAndUpdateOrderStatus(updatedOrder);
  }
};


  const validateAndUpdateOrderStatus = async (order) => {
    const hasErrors = orderHasBatchErrors(order);
    
    // Don't downgrade from "packed" status - only upgrade
    const newStatus = hasErrors ? "order placed" : "ready to pack";
    if (order.order_status !== newStatus && order.order_status !== "packed") {
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


  const handleOrderClick = useCallback((order, event) => {
    // Check for shift+click
    if (event?.shiftKey) {
      event.preventDefault();
      toggleOrderSelection(order.id);
      return;
    }
    
    // Normal click - open modal if not in select mode
    if (!selectMode) {
      setSelectedOrder(order);
      setViewModal(true);
      setSplitToggleError("");
    } else {
      toggleOrderSelection(order.id);
    }
  }, [selectMode])

  const toggleOrderSelection = (orderId) => {
    setSelectMode(true);
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        const newSelection = prev.filter(id => id !== orderId);
        // Exit select mode if no orders selected
        if (newSelection.length === 0) {
          setSelectMode(false);
        }
        return newSelection;
      } else {
        return [...prev, orderId];
      }
    });
  };

  const handlePressStart = useCallback((order, event) => {
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    setStartPos({ x: clientX, y: clientY });
    setHasMoved(false);
    
    const timer = setTimeout(() => {
      if (!hasMoved) {
        toggleOrderSelection(order.id);
      }
    }, 800);
    
    setPressTimer(timer);
  }, [hasMoved]);

  const handlePressMove = useCallback((event) => {
    if (pressTimer) {
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      
      const deltaX = Math.abs(clientX - startPos.x);
      const deltaY = Math.abs(clientY - startPos.y);
      
      // If moved more than 10px, cancel the press timer
      if (deltaX > 10 || deltaY > 10) {
        setHasMoved(true);
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
    }
  }, [pressTimer, startPos]);

  const handlePressEnd = useCallback(() => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  }, [pressTimer]);

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
  // console.log("🔍 Checking batch errors for order:", order.customer_name);
  // console.log("📋 Order pizzas:", Object.keys(order.pizzas));
  
  return Object.entries(order.pizzas).some(([pizzaName, pizzaData]) => {
    const totalOrdered = pizzaData.quantity;
    // console.log(`🍕 Checking ${pizzaName}: ordered=${totalOrdered}`);
    
    // Skip pizzas with 0 quantity (deleted pizzas)
    if (!totalOrdered || totalOrdered <= 0) {
      // console.log(`⏭️ Skipping ${pizzaName} - quantity is 0 or undefined`);
      return false;
    }
    
    // Safety check for batchesUsed
    if (!pizzaData.batchesUsed) {
      // console.log(`❌ ${pizzaName} - No batchesUsed property`);
      return true;
    }
    
    const selectedBatches = pizzaData.batchesUsed.filter(b => b.batch_number);
    const totalAssigned = selectedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    // console.log(`📦 ${pizzaName} batches:`, selectedBatches.map(b => `${b.batch_number}(${b.quantity})`).join(', '));
    // console.log(`📊 ${pizzaName} assigned=${totalAssigned} vs ordered=${totalOrdered}`);
    
    if (selectedBatches.length === 0) {
      // console.log(`❌ ${pizzaName} - No batches selected`);
      return true;
    }
    if (!isSplitChecked) {
      const batch = batches.find(b => b.batch_code === selectedBatches[0]?.batch_number);
      if (!batch) {
        // console.log(`❌ ${pizzaName} - Batch not found:`, selectedBatches[0]?.batch_number);
        return true;
      }
      const available = getAvailableQuantity(batch, pizzaName, order.id);
      const hasError = available < totalOrdered;
      // console.log(`📊 ${pizzaName} - available=${available}, hasError=${hasError}`);
      return hasError;
    } else {
      const anyOverused = selectedBatches.some(b => {
        const batch = batches.find(batch => batch.batch_code === b.batch_number);
        return !batch || b.quantity > getAvailableQuantity(batch, pizzaName, order.id);
      });
      const mismatch = totalAssigned !== totalOrdered;
      const hasError = anyOverused || mismatch;
      // console.log(`📊 ${pizzaName} split mode - overused=${anyOverused}, mismatch=${mismatch}, hasError=${hasError}`);
      return hasError;
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

  const matchesSearch = (
    order.customer_name?.toLowerCase().includes(search) ||
    order.sample_customer_name?.toLowerCase().includes(search) ||
    order.order_status?.toLowerCase().includes(search) ||
    matchesDeliveryDay ||
    customer.delivery_region?.toLowerCase().includes(search) ||
    order.account_ID?.toLowerCase().includes(search)
  );

  // Apply sleeve filter
  if (sleeveFilter === "all") {
    return matchesSearch;
  }

  // Check if order contains sleeved or non-sleeved pizzas
  const hasSleevedPizzas = Object.keys(order.pizzas || {}).some(pizzaId => {
    const pizza = pizzaCatalog.find(p => p.id === pizzaId);
    return pizza && pizza.sleeve === true;
  });

  const hasNonSleevedPizzas = Object.keys(order.pizzas || {}).some(pizzaId => {
    const pizza = pizzaCatalog.find(p => p.id === pizzaId);
    return pizza && pizza.sleeve === false;
  });

  if (sleeveFilter === "sleeve") {
    return matchesSearch && hasSleevedPizzas;
  }

  if (sleeveFilter === "noSleeve") {
    return matchesSearch && hasNonSleevedPizzas;
  }

  return matchesSearch;
});

  // Apply sort function to filtered orders
  const sortedOrders = sortOrders(filteredOrders);

  // Sort by delivery date - invalid dates at top, then valid dates newest first
  const sortedByDeliveryDate = [...filteredOrders].sort((a, b) => {
    // Check if delivery_day is a valid YYYY-MM-DD format
    const isValidDate = (dateStr) => {
      return dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr));
    };
    
    const aValid = isValidDate(a.delivery_day);
    const bValid = isValidDate(b.delivery_day);
    
    // Both invalid - maintain order
    if (!aValid && !bValid) return 0;
    // A invalid, B valid - A goes first (top)
    if (!aValid && bValid) return -1;
    // A valid, B invalid - B goes first (top)
    if (aValid && !bValid) return 1;
    
    // Both valid - sort by date newest first
    return b.delivery_day.localeCompare(a.delivery_day);
  });
  
  // Add pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = sortedByDeliveryDate.slice(indexOfFirstOrder, indexOfLastOrder);
  



// PACKING LIST
  const generatePDF = () => {
    const selected = orders.filter(o => selectedOrders.includes(o.id));

    let html = `<html>
    <head><title>Combined Orders</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .order-block { margin-bottom: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 1rem; }
      h3 { margin-top: 0; }
    </style>
    
    </head>
    
    <body>
    `;

    selected.forEach(order => {
      let customerName;
      if (order.customer_name === 'SAMPLES' && order.sample_customer_name) {
        customerName = `SAMPLE: ${order.sample_customer_name}`;
      } else if (order.customer_name === 'Weddings & Private Events' && order.sample_customer_name) {
        customerName = `Wedding/Event: ${order.sample_customer_name}`;
      } else {
        customerName = order.customer_name || order.account_ID;
      }
      
      html += `
      <div class="order-block" style="display: flex; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 1rem;">
        <div style="width: 65%;">
          <h3 style="margin-top: 0;">${customerName}</h3>
          <p><strong>Total Pizzas:</strong> ${order.pizzaTotal}</p>`;

      Object.entries(order.pizzas).forEach(([pizzaId, pizzaData]) => {
        const pizzaName = pizzaTitles[pizzaId] || pizzaId;
        
        // Check if pizza has batch assignments
        if (pizzaData.batchesUsed && pizzaData.batchesUsed.length > 0) {
          pizzaData.batchesUsed.forEach(b => {
            const batchDate = formatBatchDate(b.batch_number);
            const batchCode = b.batch_number || 'unassigned';
            html += `<p>${pizzaName} x ${b.quantity} batch: ${batchDate ? ` ${batchDate}` : ''}</p>`;
          });
        } else if (pizzaData.quantity > 0) {
          // Show pizzas without batch assignments (like dough balls)
          html += `<p>${pizzaName} x ${pizzaData.quantity} (no batch assigned)</p>`;
        }
      });

      html += `
        </div>
        <div style="width: 30%; height: min-content; border-radius: 5px; border: 1px solid #909090; padding: 15px;">
          <p style="margin:0; padding:4px 0">
          Signature:____________</p>
          <p style="margin:0; padding:4px 0">
          Name:_______________</p>
          <p style="margin:0; padding:4px 0">
          Date:________________</p>
        </div>
      </div>`;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
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
  <object data="/bertha_logo_bw.png" type="image/png" style="max-height: 100px; width: auto;">
    <img src="/bertha_logo_bw.png" style="max-height: 100px;" alt="Bertha's Logo" />
  </object>
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
      <div style="margin-top: 40px; padding-top: 20px;">
        <h4 style="margin-bottom: 2px;">Goods Recieved By:</h3>
        <div>
            <p style="margin:0; padding:2px 0">
            Signature:____________________</p>
            <p style="margin:0; padding:2px 0">
            Print Signature:________________</p>
            <p style="margin:0; padding:2px 0">
            Date:________________________</p>
        </div>
      </div>
    </div>`;

  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
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
    <div style=" margin-bottom: 20px;">
      <object data="/bertha_logo_bw.png" type="image/png" style="max-height: 100px; width: auto;">
        <img src="/bertha_logo_bw.png" style="max-height: 100px;" alt="Bertha's Logo" />
      </object>
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
        
        <div style="margin-top: 40px; padding-top: 20px;">
        <h4 style="margin-bottom: 2px;">Goods Recieved By:</h3>
        <div>
            <p style="margin:0; padding:2px 0">
            Signature:____________________</p>
            <p style="margin:0; padding:2px 0">
            Print Signature:________________</p>
            <p style="margin:0; padding:2px 0">
            Date:________________________</p>
        </div>
      </div>
      </div>`;
  });

  html += `</body></html>`;

  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
};





  // Download raw order data function for use in excel/google sheets
  const downloadRawOrdersCSV = () => {
  // Filter orders to only include selected ones
  const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id));
  
  // Get all pizza types from the pizzas collection and sort them
  const allPizzaTypes = pizzaCatalog.map(pizza => pizza.id);

  // Sort pizza types: all _1s first (alphabetical), then all _0s (alphabetical), then TOM_A0, DOU_A1, DOU_A0 at the end
  const sortedPizzaTypes = allPizzaTypes.sort((a, b) => {
    const getCategory = (id) => {
      if (id === 'TOM_A0') return 4;
      if (id === 'DOU_A1') return 5;
      if (id === 'DOU_A0') return 6;
      if (id.includes('_A1')) return 1;
      if (id.includes('_B1')) return 1;
      if (id.includes('_A0')) return 2; 
      if (id.includes('_B0')) return 2;
      return 3; // Everything else third
    };

    const categoryA = getCategory(a);
    const categoryB = getCategory(b);
    
    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }
    
    // Within same category, sort alphabetically
    return a.localeCompare(b);
  });
  
  // Prepare raw order data
  const rawData = selectedOrdersData.map((order) => {
    const customerName = order.customer_name === 'SAMPLES' ? `SAMPLE: ${order.sample_customer_name}` :  order.customer_name === 'Weddings & Private Events' ? `Wedding/Event: ${order.sample_customer_name}`: order.customer_name;
    
    // Format delivery date as DD/MM/YYYY
    const deliveryDate = order.delivery_day === 'tbc' || !order.delivery_day 
      ? 'tbc' 
      : dayjs(order.delivery_day).format('DD/MM/YYYY');
    const accountId = order.account_ID || '-';
    const orderTimestamp = order.order_placed_timestamp || '-';
    const purchaseOrder = order.purchase_order || '-';
    const additionalNotes = order.additional_notes || '-';
    
    // Create pizza quantity object - include ALL pizza types, even if not ordered
    const pizzaQuantities = {};
    sortedPizzaTypes.forEach((pizzaType) => {
      pizzaQuantities[pizzaType] = order.pizzas?.[pizzaType]?.quantity || '';
    });

    return {
      'Customer Name': customerName,
      'Account ID': accountId,
      'Delivery Date': deliveryDate,
      'Pizza Total': '', // Leave blank instead of using order.pizzaTotal
      ...pizzaQuantities,
      'Order Timestamp': orderTimestamp,
      'Purchase Order': purchaseOrder,
      'Additional Notes': additionalNotes
    };
  });

  if (rawData.length === 0) {
    alert('No orders selected for download.');
    return;
  }

  // Create CSV headers 
  const headers = [
    'Customer Name', 'Account ID', 'Delivery Date', 
    'Pizza Total', 
    ...sortedPizzaTypes,
    'Order Timestamp', 'Purchase Order', 'Additional Notes'
  ];

  // Create CSV rows 
  const csvRows = [
    headers.join(','), // Header row
    ...rawData.map(row => {
      const baseFields = [
        `"${row['Customer Name']}"`,
        `"${row['Account ID']}"`,
        `"${row['Delivery Date']}"`,
        '' // Empty string for Pizza Total
      ];
      
      const pizzaFields = sortedPizzaTypes.map(pizzaType => row[pizzaType] || '');
      
      const endFields = [
        `"${row['Order Timestamp']}"`,
        `"${row['Purchase Order']}"`,
        `"${row['Additional Notes']}"`
      ];
      
      return [...baseFields, ...pizzaFields, ...endFields].join(',');
    })
  ];

  // Create and download the file
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `selected-orders-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};


useEffect(() => {
if (!selectedOrder) return;
  const hasSplit = Object.values(selectedOrder.pizzas || {}).some(pizza => {
    if (!Array.isArray(pizza.batchesUsed)) return false;
    const nonZeroBatches = pizza.batchesUsed.filter(b => b.batch_number && Number(b.quantity) > 0);
    // More than one batch: disable
    if (nonZeroBatches.length > 1) return true;
    // One batch, but quantity doesn't match ordered: disable
    if (nonZeroBatches.length === 1 && Number(nonZeroBatches[0].quantity) !== Number(pizza.quantity)) return true;
    return false;
  });
  setIsSplitChecked(hasSplit);
}, [selectedOrder]);


const isSplitToggleDisabled = selectedOrder && Object.values(selectedOrder.pizzas || {}).some(pizza => {
  if (!Array.isArray(pizza.batchesUsed)) return false;
  const nonZeroBatches = pizza.batchesUsed.filter(b => b.batch_number && Number(b.quantity) > 0);
  // More than one batch: disable
  if (nonZeroBatches.length > 1) return true;
  // One batch, but quantity doesn't match ordered: disable
  if (nonZeroBatches.length === 1 && Number(nonZeroBatches[0].quantity) !== Number(pizza.quantity)) return true;
  return false;
});

useEffect(() => {
  if (!isSplitToggleDisabled) {
    setSplitToggleError("");
  }
}, [isSplitToggleDisabled]);

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



  const customerDefaultView = selectedOrder
  ? allCustomers[selectedOrder.account_ID]?.default_pizza_view || null
  : null;

  return (
  <div className='orders navContent'>
    <h2>ORDERS</h2>

    <div className="sleeveFilter" style={{ marginBottom: 16 }}>
          <label>
            <input
              type="radio"
              value="all"
              className='sleeveRadio'
              checked={sleeveFilter === 'all'}
              onChange={() => setSleeveFilter('all')}
            />
            All
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="radio"
              value="sleeve"
              className='sleeveRadio'
              checked={sleeveFilter === 'sleeve'}
              onChange={() => setSleeveFilter('sleeve')}
            />
            Sleeve
          </label>
          <label style={{ marginLeft: 12 }}>
            <input
              type="radio"
              value="noSleeve"
              className='sleeveRadio'
              checked={sleeveFilter === 'noSleeve'}
              onChange={() => setSleeveFilter('noSleeve')}
            />
            No Sleeve
          </label>
        </div>

    <div className='today'><span className='deliveryToday'>Today: {dayjs().format('ddd DD-MM-YYYY')}</span></div>
    <div className='selectOrdersAndSearchOrders'>
      <div className='selectCancel' {...(selectedOrders.length > 0 && { 'data-count': selectedOrders.length })}>
        {selectMode && (
          <button
            className='button'
            onClick={() => {
              setSelectedOrders([]);
              setSelectMode(false);
            }}
          >
            Cancel Selection ({selectedOrders.length})
          </button>
        )}
        {selectMode && (
          <button
            className='button button-secondary'
            onClick={() => {
              const allVisibleOrderIds = sortedOrders.map(order => order.id);
              const allSelected = allVisibleOrderIds.every(id => selectedOrders.includes(id));
              
              if (allSelected) {
                // Deselect all visible orders
                setSelectedOrders(prev => prev.filter(id => !allVisibleOrderIds.includes(id)));
              } else {
                // Select all visible orders (merge with existing selection)
                setSelectedOrders(prev => {
                  const newSelection = [...prev];
                  allVisibleOrderIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                      newSelection.push(id);
                    }
                  });
                  return newSelection;
                });
              }
            }}
            style={{ marginLeft: '8px' }}
          >
            {sortedOrders.every(order => selectedOrders.includes(order.id)) ? "Deselect All" : "Select All"}
            {searchTerm && ` (${sortedOrders.length} filtered)`}
          </button>
        )}
      </div>
      {selectedOrders.length > 0 && (
        <div className="bulk-actions" >
          <button className="button button-icon" onClick={generatePDF} title="Generate Packing List">
            <FontAwesomeIcon icon={faList} />
            <span className="mobile-label">Packing List</span>
          </button>
          <button className="button button-icon" onClick={handleBulkPrintPackingSlips} title="Generate Packing Slips">
            <FontAwesomeIcon icon={faReceipt} />
            <span className="mobile-label">Packing Slips</span>
          </button>
          <button className="button button-icon" onClick={() => markSelectedAsPacked()} title="Mark as Packed">
            <FontAwesomeIcon icon={faBox} />
            <span className="mobile-label">Mark Packed</span>
          </button>
          <button className="button button-icon" onClick={() => markSelectedAsComplete()} title="Mark as Complete">
            <FontAwesomeIcon icon={faCheckSquare} className='checkGreen' />
            <span className="mobile-label">Complete</span>
          </button>
          <button className="button button-icon" onClick={() => downloadRawOrdersCSV()} title="Download CSV">
            <FontAwesomeIcon icon={faDownload} />
            <span className="mobile-label">CSV</span>
          </button>
        </div>
      )}

      <input
        type="text"
        placeholder="Search orders..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginRight: 8 }}
      />
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
              ${selectedOrders.includes(order.id) ? 'selected' : ''}
              `}
              onClick={(e) => handleOrderClick(order, e)}
              onMouseDown={(e) => handlePressStart(order, e)}
              onTouchStart={(e) => handlePressStart(order, e)}
              onMouseMove={handlePressMove}
              onTouchMove={handlePressMove}
              onMouseUp={handlePressEnd}
              onTouchEnd={handlePressEnd}
              onMouseLeave={handlePressEnd}
              >
            <div>{order.customer_name === 'SAMPLES' ? `SAMPLE: ${order.sample_customer_name}` :  order.customer_name === 'Weddings & Private Events' ? `Wedding/Event: ${order.sample_customer_name}`: order.customer_name}</div>
            <div>{order.pizzaTotal}</div>
            <div className='orderStatus'>
              {order.order_status === 'order placed' && ''}
              {order.order_status === 'ready to pack' && <FontAwesomeIcon icon={faBoxOpen} />}
              {order.order_status === 'packed' && <FontAwesomeIcon icon={faBox} />}
              {order.order_status === 'complete' && <FontAwesomeIcon icon={faCheckSquare} className='checkGreen' />}
            </div>
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
      {(() => {
        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        if (totalPages <= 1) return null;

        const buttons = [];
        
        // Previous button
        if (currentPage > 1) {
          buttons.push(
            <button
              key="prev"
              className="page-button"
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              ‹
            </button>
          );
        }

        // First page
        if (currentPage > 3) {
          buttons.push(
            <button
              key={1}
              className="page-button"
              onClick={() => setCurrentPage(1)}
            >
              1
            </button>
          );
          if (currentPage > 4) {
            buttons.push(<span key="dots1" className="page-dots">...</span>);
          }
        }

        // Current page and neighbors
        const start = Math.max(1, currentPage - 1);
        const end = Math.min(totalPages, currentPage + 1);
        
        for (let i = start; i <= end; i++) {
          buttons.push(
            <button
              key={i}
              className={`page-button ${currentPage === i ? 'active' : ''}`}
              onClick={() => setCurrentPage(i)}
            >
              {i}
            </button>
          );
        }

        // Last page
        if (currentPage < totalPages - 2) {
          if (currentPage < totalPages - 3) {
            buttons.push(<span key="dots2" className="page-dots">...</span>);
          }
          buttons.push(
            <button
              key={totalPages}
              className="page-button"
              onClick={() => setCurrentPage(totalPages)}
            >
              {totalPages}
            </button>
          );
        }

        // Next button
        if (currentPage < totalPages) {
          buttons.push(
            <button
              key="next"
              className="page-button"
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              ›
            </button>
          );
        }

        return buttons;
      })()}
    </div>
    {selectedOrder && (
        <div className='orderModalOverlay'>
        <div className='modalContent orderModal' ref={modalRef}>
          <div className='orderDetailsAndSlip'>
            <div>- Order Details -</div>
            {selectedOrder.account_ID !== "WASTAGE" && (
            <button className='button packButton' onClick={handlePrintClick}>
              <FontAwesomeIcon icon={faReceipt} className='icon' /> Packing Slip
            </button>
            )}
          </div>
          <div className='orderContent'>
            {selectedOrder.account_ID !== "WASTAGE" && (
            <p><strong>Account ID:</strong> {selectedOrder.account_ID}</p>
            )}
            {selectedOrder.account_ID !== "WASTAGE" && (
            <p><strong>Customer:  </strong> {selectedOrder.customer_name === 'SAMPLES' ? `SAMPLE: ${selectedOrder. sample_customer_name}` :  selectedOrder.customer_name === 'Weddings & Private Events' ? `Wedding/Event: ${selectedOrder.sample_customer_name}`: selectedOrder.customer_name}</p>
            )}

            {selectedOrder.account_ID !== "SAMPLES/6UGM" && selectedOrder.account_ID !== "WEDDINGSPRIVATEEVENTS" && selectedOrder.account_ID !== "WASTAGE" &&
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
            {selectedOrder.account_ID !== "WASTAGE" && (
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
            )}

            {selectedOrder.account_ID !== "WASTAGE" && (
            <p><strong>Order Placed: </strong> {formatDate(selectedOrder.timestamp)}</p>
            )}

            <p><strong>{selectedOrder.account_ID === "WASTAGE" ? "Additional Notes:" : "Delivery Notes:"} </strong>
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

            {selectedOrder.account_ID === "WASTAGE" && selectedOrder.wastage_reason && (
            <p><strong>Wastage Reason:</strong> {selectedOrder.wastage_reason}</p>
            )}

            {selectedOrder.account_ID !== "WASTAGE" && (
            <p><strong>Delivery Week:</strong> {selectedOrder.delivery_week}</p>
            )}
            <div className='flexRow'>
            <strong className='space'>{selectedOrder.account_ID === "WASTAGE" ? "Day of Wastage:" : "Delivery Day:"}</strong>{" "}
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
            <strong>{selectedOrder.account_ID === "WASTAGE" ? "Pizzas Wasted:" : "Pizzas Ordered:"}</strong>
            {selectedOrder.account_ID !== "WASTAGE" && (
            <div 
              className='button pencil clickable'
              title="edit order quantities"
              onClick={() =>{
                setEditQuantities(q => !q);
                if (showEditQtyHint) {
                  setShowEditQtyHint(false);
                  localStorage.setItem('hasSeenEditQtyInstruction', 'true');
                }
              }}>
              <FontAwesomeIcon
                icon={faPencilAlt}
                className="icon"
              />
            </div>
            )}
            {selectedOrder.account_ID !== "WASTAGE" && showEditQtyHint && (
              <div className='editOrderQtyContainer'>
                <FontAwesomeIcon
                    icon={faArrowLeft}
                    className='orderQtyHintArrow'
                />
                <p className='orderQtyHint'>edit ordered quantities</p>
              </div>
            )}
              {selectedOrder.account_ID !== "WASTAGE" && (
              <div
                style={{ display: "inline-block" }}
                onClick={e => {
                  if (isSplitToggleDisabled) {
                    setSplitToggleError("*allocated must match ordered before reverting and cannot revert on split batches");
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
                    disabled={isSplitToggleDisabled}
                    onChange={e => {
                      setIsSplitChecked(e.target.checked);
                      if (showSplitHint) {
                        setShowSplitHint(false);
                        localStorage.setItem('hasSeenSplitInstruction', 'true');
                      }
                    }}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              )}
            </div>
              {splitToggleError && (
                <div className="tbc toggleError">
                  {splitToggleError}
                </div>
              )}

              {selectedOrder.account_ID !== "WASTAGE" && showSplitHint && (
                <div className="split-hint-container">
                  <div className="split-hint-tooltip">
                    Toggle to fulfill with multiple batch codes
                  </div>
                  <FontAwesomeIcon
                    icon={faArrowTurnUp}
                    className='split-hint-arrow'
                  />
                </div>
              )}


            {Object.entries(selectedOrder.pizzas)
              .filter(([_, pizzaData]) => pizzaData.quantity > 0)
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
                <p className='allocatedText'>allocated {getPizzaAllocatedTally(pizzaData).allocated} / </p>
                {editQuantities ? (
                  <input
                    type="number"
                    min={0}
                    value={draftQuantities[pizzaName] ?? pizzaData.quantity}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setDraftQuantities(prev => ({ ...prev, [pizzaName]: val }));
                    }}
                    onBlur={async () => {
                      const newQty = draftQuantities[pizzaName] ?? pizzaData.quantity;
                      
                      if (newQty > 0) {
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
                      } else {
                        // Remove pizza from Firestore completely if set to 0
                        await updateDoc(doc(db, "orders", selectedOrder.id), {
                          [`pizzas.${pizzaName}`]: deleteField(),
                          pizzaTotal: calculatePizzaTotal(
                            Object.fromEntries(
                              Object.entries(selectedOrder.pizzas).filter(([id]) => id !== pizzaName)
                            )
                          ),
                        });
                        // Remove from local state
                        setSelectedOrder(prev => {
                          const newPizzas = { ...prev.pizzas };
                          delete newPizzas[pizzaName];
                          return {
                            ...prev,
                            pizzas: newPizzas,
                            pizzaTotal: calculatePizzaTotal(newPizzas),
                          };
                        });
                        // Remove batch allocations
                        const batchesUsed = selectedOrder.pizzas[pizzaName].batchesUsed || [];
                        for (const batch of batchesUsed) {
                          await removePizzaAllocationFromBatch({
                            pizzaId: pizzaName,
                            batchCode: batch.batch_number
                          });
                        }
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") e.target.blur();
                    }}
                    style={{ width: 60 }}
                  />
                ) : (
                  <p className='allocatedText'>{pizzaData.quantity}
                  </p>
                )}
              </div>    
              {(() => {
                const totalOrdered = pizzaData.quantity;
                const batchesUsed = pizzaData.batchesUsed || [];
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
                    const isSelected = (pizzaData.batchesUsed || []).some(b => b.batch_number === batch.batch_code);
                    const selectedBatch = (pizzaData.batchesUsed || []).find(b => b.batch_number === batch.batch_code);
                    const available = getAvailableQuantity(batch, pizzaName, selectedOrder.id);
                    const quantity = selectedBatch?.quantity || 0;
                    const hasSelection = (pizzaData.batchesUsed || []).some(b => !!b.batch_number);

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
              {/* Found Stock - moved to end of batch list */}
              <div className='foundStockFlex batchButton'
                    onClick={() => toggleFoundStock(pizzaName)}>
                  <div 
                    className="foundStockHeader"
                  >
                  Add Found Stock {expandedFoundStock[pizzaName] ? '⌄' : '>'}
                </div>

                {expandedFoundStock[pizzaName] && foundStockData[pizzaName] && (
                  <div className='foundStockData' style={{ 
                    backgroundColor: pizzaCatalog.find(p => p.id === pizzaName)?.hex_colour || '#fff',

                  }}>
                    <h4 className='foundStockPizza'>Found Stock - {pizzaTitles[pizzaName] || pizzaName}</h4>
                    <div className='foundStockList'>
                    {foundStockData[pizzaName].map(batch => {
                      const pizza = batch.pizzas?.find(p => p.id === pizzaName);
                      if (!pizza) return null;
                      
                      return (
                        <div key={batch.id} className='foundStockListItem'>
                          <strong>{formatBatchCode(batch.batch_code)}</strong>
                          <div>Available: {getAvailableQuantity(batch, pizzaName, selectedOrder.id)} {pizza.archived ? '(archived)' : ''}</div>
                          <div className='foundStockButtons'>
                            <button
                              className='addMinusButton'
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBatchQuantity(batch.id, pizzaName, -1);
                              }}
                              disabled={pizza.quantity <= 0}
                            >
                              -
                            </button>
                            <button
                              className='addMinusButton'
                              onClick={(e) => {
                                e.stopPropagation();
                                updateBatchQuantity(batch.id, pizzaName, 1);
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
              </div>


            </div>
          ))}
          {editQuantities && (
            pizzaCatalog
            .filter(pizza => {
            // Only show pizzas not already in the order
                if (selectedOrder.pizzas[pizza.id] && selectedOrder.pizzas[pizza.id].quantity) return false;
                // Only show pizzas matching the customer's default view
                if (customerDefaultView === "withSleeve" && !pizza.sleeve) return false;
                if (customerDefaultView === "withoutSleeve" && pizza.sleeve) return false;
                // If 'all', show all pizzas
                return true;
              })
              .map(pizza => {
                const pizzaId = pizza.id;
                const pizzaData = selectedOrder.pizzas[pizzaId] || {};
                return (
                  <div key={pizzaId} className='flexRow'>
                    <p className='space'>{pizzaTitles[pizzaId] || pizzaId}:</p>
                    <input
                      type="number"
                      min={0}
                      value={draftQuantities[pizzaId] ?? pizzaData.quantity ?? 0}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setDraftQuantities(prev => ({ ...prev, [pizzaId]: val }));
                      }}
                      onBlur={async () => {
                        const newQty = draftQuantities[pizzaId] ?? pizzaData.quantity ?? 0;
                        if (newQty > 0) {
                          // Add or update pizza in Firestore
                          await updateDoc(doc(db, "orders", selectedOrder.id), {
                            [`pizzas.${pizzaId}.quantity`]: newQty,
                            pizzaTotal: calculatePizzaTotal({
                              ...selectedOrder.pizzas,
                              [pizzaId]: { ...pizzaData, quantity: newQty }
                            }),
                          });
                          setSelectedOrder(prev => ({
                            ...prev,
                            pizzas: {
                              ...prev.pizzas,
                              [pizzaId]: {
                                ...prev.pizzas[pizzaId],
                                quantity: newQty,
                              }
                            },
                            pizzaTotal: calculatePizzaTotal({
                              ...prev.pizzas,
                              [pizzaId]: { ...prev.pizzas[pizzaId], quantity: newQty }
                            }),
                          }));
                        } else {
                          // Remove pizza from Firestore and local state if set to 0
                          await updateDoc(doc(db, "orders", selectedOrder.id), {
                            [`pizzas.${pizzaId}`]: deleteField(),
                            pizzaTotal: calculatePizzaTotal(
                              Object.fromEntries(
                                Object.entries(selectedOrder.pizzas).filter(([id]) => id !== pizzaId)
                              )
                            ),
                          });
                          setSelectedOrder(prev => {
                            const newPizzas = { ...prev.pizzas };
                            delete newPizzas[pizzaId];
                            return {
                              ...prev,
                              pizzas: newPizzas,
                              pizzaTotal: calculatePizzaTotal(newPizzas),
                            };
                          });
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") e.target.blur();
                      }}
                      style={{ width: 60 }}
                    />
                  </div>
                );
              })
          )}
            <p><strong>Total Pizzas:</strong> {selectedOrder.pizzaTotal}</p>
            {selectedOrder.account_ID !== "WASTAGE" && (
            <p><strong>Order Status: </strong> {selectedOrder.order_status}</p>
            )}
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
                        return { ...allocation, status: "incomplete" }; // <-- revert to incomplete
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
            className='button deleteButton'
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

function cleanEmptyBatchAllocations(order) {
  const updatedOrder = { ...order, pizzas: { ...order.pizzas } };
  let changed = false;
  Object.entries(updatedOrder.pizzas).forEach(([pizzaName, pizzaData]) => {
    if (Array.isArray(pizzaData.batchesUsed)) {
      const filtered = pizzaData.batchesUsed.filter(
        b => b.batch_number && b.quantity > 0
      );
      if (filtered.length !== pizzaData.batchesUsed.length) {
        updatedOrder.pizzas[pizzaName] = { ...pizzaData, batchesUsed: filtered };
        changed = true;
      }
    }
  });
  return changed ? updatedOrder : order;
}

export default Orders;