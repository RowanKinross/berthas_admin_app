// import berthasLogo from './bertha_logo'
import './inventory.css';
import React, {useState, useEffect, useRef} from 'react';
import { app, db } from '../firebase/firebase';
import { collection, addDoc, getDocs, getDoc, doc, updateDoc } from '@firebase/firestore'; 
import { Dropdown, Button, Form } from 'react-bootstrap';

function Inventory() {
  // pizzas
  const [modalVisible, setModalVisible] = useState(false); // modal for adding a new pizza
  const [pizzaTitle, setPizzaTitle] = useState(''); //title of new pizza
  const [hexColour, setHexColour] = useState(''); // colour of new pizza
  const [pizzaData, setPizzaData] = useState([]); // pizza data from storage
  const [sleeve, setSleeve] = useState(false);
  // sleeve radio
  const [sleeveFilter, setSleeveFilter] = useState('all');

  // ingredients
  const [ingredientsArr, setIngredientsArr] = useState([]); // an array of saved ingredients for the dropdown
  const [ingredientName, setIngredientName] = useState('');
  const [currentIngredientQuantity, setCurrentIngredientQuantity] = useState('');
  const [ingredientUnits, setIngredientUnits] = useState('');
  const [ingredientUnitQuantity, setIngredientUnitQuantity] = useState('');
  const [addIngredientForm, setAddIngredientForm] = useState(false); // set ingredients form to not show
  const [currentIngredient, setCurrentIngredient] = useState([]);
  const [currentPizzaIngredients, setCurrentPizzaIngredients] = useState(["Flour (Caputo Red)", "Salt"]);
  const [editingField, setEditingField] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState({});

  // stock
  const [stock, setStock] = useState([]);
  const [totalStockOverall, setTotalStockOverall] = useState(0);
  const [totalOnOrderOverall, setTotalOnOrderOverall] = useState(0);
  const [totalAvailableOverall, setTotalAvailableOverall] = useState(0);
  
  // modal for clicking on a batch
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedPizzaId, setSelectedPizzaId] = useState(null);
  const [archiveQty, setArchiveQty] = useState('');
  const [orders, setOrders] = useState([]);





  // FETCHES
  // fetch pizza data e.g what pizzas we offer & their hex codes
  const fetchPizzaData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'pizzas'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()}));
      data.sort((a, b) => {
        if (a.sleeve === b.sleeve) {
          return a.id.localeCompare(b.id);
        }
        return a.sleeve ? -1 : 1;
      });
      setPizzaData(data);
    } catch (error) {
      console.error("Error fetching pizza data:", error); // Debugging statement
    }
  };

  // fetch stock data e.g what pizzas are in stock & their batches
  const fetchStock = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'batches'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStock(data);
 
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  };

  // fetch ingredients array (list of possible ingredients & their weights per unit)
  const fetchIngredientsArr = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'ingredients'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const items = data.map(item => item);
      setIngredientsArr(items);
    } catch (error) {
      console.error("Error fetching ingredients data:", error);
    }
  };
  // fetch orders
  const fetchOrders = async () => {
  try {
      const querySnapshot = await getDocs(collection(db, "orders"));
      const orderList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOrders(orderList);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };


  // calculate totals
  const calculateOverallTotals = (pizzas, batches) => {
    let totalStock = 0;
    let totalOnOrder = 0;
    let totalAvailable = 0;
  
    pizzas.forEach((pizza) => {
      batches.forEach((batch) => {
        if (batch.completed) {
          const match = batch.pizzas.find(p => p.id === pizza.id);
          if (match) {
          const allocations = batch.pizza_allocations || [];

          const completedQty = allocations
            .filter(a => a.pizzaId === pizza.id && a.status === "completed")
            .reduce((sum, a) => sum + a.quantity, 0);

          const activeQty = allocations
            .filter(a => a.pizzaId === pizza.id && a.status !== "completed")
            .reduce((sum, a) => sum + a.quantity, 0);

          const effectiveQuantity = match.quantity - completedQty;

          totalStock += effectiveQuantity;
          totalOnOrder += activeQty;
          totalAvailable += effectiveQuantity - activeQty;
          }
        }
      });
    });
  
    setTotalStockOverall(totalStock);
    setTotalOnOrderOverall(totalOnOrder);
    setTotalAvailableOverall(totalAvailable);
  }


  // render pizza data, stock data and ingredients data dynamically
  useEffect(() => {
    fetchPizzaData();
    fetchStock();
    fetchIngredientsArr(); 
    fetchOrders();
  }, []);

  useEffect(() => {
    calculateOverallTotals(pizzaData, stock);
  }, [pizzaData, stock]);


  // UPDATE STORE
  // add a new ingredient to ingredients array 
  const updateIngredientsArr = async (newIngredient) => {
    try {
      await addDoc(collection(db, 'ingredients'), newIngredient);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  // ADD TO STORE
  // add pizza function for when user clicks on '+'
  const handleAddPizza = async () => {
    const vegan = currentPizzaIngredients.includes("Vegan Mozzarella") ? "B" : "A";
    const withSleeve = sleeve ? 1 : 0;
    const IDletters = (`${pizzaTitle.charAt(0)}${pizzaTitle.charAt(1)}${pizzaTitle.charAt(2)}`).toUpperCase();

    const ID = `${IDletters}_${vegan}${withSleeve}`;
   
    try {
      await addDoc(collection(db, 'pizzas'), {
        id: ID,
        pizza_title: pizzaTitle,
        ingredients: currentPizzaIngredients,
        hex_colour: hexColour,
        sleeve: sleeve,
      });
      fetchPizzaData();
      closeModal();
      setCurrentPizzaIngredients(["Flour (Caputo Red)", "Salt"]);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  // ADD PIZZA MODAL
  // close the modal
  const closeModal = () => {
    setModalVisible(false);
  };

  const handleCancel = () => {
    closeModal();
    setCurrentPizzaIngredients(["Flour (Caputo Red)", "Salt"]);
    setCurrentIngredient("");
  };

  const handleAddIngredient = async () => {
    setAddIngredientForm(false); // hide add ingredient form
    
    const newIngredientName = ingredientName;
    const newIngredientPackaging = ingredientUnits;
    const newIngredientRatio = `${currentIngredientQuantity}:${ingredientUnitQuantity}`;

    const newIngredient = {
      name: newIngredientName,
      packaging: newIngredientPackaging,
      ratio: newIngredientRatio
    };

    setCurrentIngredient(newIngredientName);

    await updateIngredientsArr(newIngredient);
    await fetchIngredientsArr(); // Re-fetch ingredients to update dropdown

    // Clear fields after async operations
    setIngredientName(''); 
    setIngredientUnits('');
    setCurrentIngredientQuantity('');
    setIngredientUnitQuantity('');
  };

  // add current ingredient to recipe on tick click
  const handleAddIngredientToRecipe = () => {
    setCurrentPizzaIngredients([...currentPizzaIngredients, currentIngredient.name]);
  };

  const handleRadioChange = (e) => {
    if (e.target.value === 'yes') {
      setSleeve(true);
    } else {
      setSleeve(false);
    }
  };

  //INLINE Save on ingredients
  const handleEditChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleBlur = async (ingredient) => {
  try {
    const updatedField = editingField.field;
    const updatedData = { ...ingredient };

    if (updatedField === 'ratio') {
      const [existingQtyPerPizza, existingQtyPerUnit] = ingredient.ratio.split(':');
      updatedData.ratio = `${editValue}:${existingQtyPerUnit}`;
    } else if (updatedField === 'unitQuantity') {
      const [existingQtyPerPizza] = ingredient.ratio.split(':');
      updatedData.ratio = `${existingQtyPerPizza}:${editValue}`;
    } else {
      updatedData[updatedField] = editValue;
    }

    const ingredientRef = doc(db, 'ingredients', ingredient.id);
    if (updatedField === 'ratio' || updatedField === 'unitQuantity') {
    await updateDoc(ingredientRef, { ratio: updatedData.ratio });
    } else {
      await updateDoc(ingredientRef, { [updatedField]: updatedData[updatedField] });
    }

    setEditingField({ id: null, field: null });
    setEditValue('');
    fetchIngredientsArr();
  } catch (error) {
    console.error('Error updating ingredient:', error);
  }
};



// Batching for minus (archive) and plus (un-archive) actions
const minusArchiveCountRef = useRef(0);
const plusArchiveCountRef = useRef(0);
const minusArchiveTimeoutRef = useRef(null);
const plusArchiveTimeoutRef = useRef(null);

const adjustArchive = (delta) => {
  if (delta === -1) {
    minusArchiveCountRef.current += 1;
    if (minusArchiveTimeoutRef.current) clearTimeout(minusArchiveTimeoutRef.current);
    minusArchiveTimeoutRef.current = setTimeout(() => {
      doMinusArchiveBatch();
    }, 500); // 500ms debounce
  } else if (delta === 1) {
    plusArchiveCountRef.current += 1;
    if (plusArchiveTimeoutRef.current) clearTimeout(plusArchiveTimeoutRef.current);
    plusArchiveTimeoutRef.current = setTimeout(() => {
      doPlusArchiveBatch();
    }, 500); // 500ms debounce
  }
};

const doMinusArchiveBatch = async () => {
  const count = minusArchiveCountRef.current;
  if (count === 0) return;
  minusArchiveCountRef.current = 0;
  try {
    const batchRef = doc(db, "batches", selectedBatch.id);
    const batchSnap = await getDoc(batchRef);
    const batchData = batchSnap.data();
    const allocations = [...(batchData.pizza_allocations || [])];
    const pizzas = [...(batchData.pizzas || [])];
    const pizzaIndex = pizzas.findIndex(p => p.id === selectedPizzaId);
    const archivedIndex = allocations.findIndex(a =>
      a.pizzaId === selectedPizzaId &&
      a.orderId === 'archived' &&
      a.status === 'completed'
    );
    if (pizzaIndex === -1) return;
    const completed = allocations
      .filter(a => a.pizzaId === selectedPizzaId && a.status === "completed")
      .reduce((sum, a) => sum + a.quantity, 0);
    const active = allocations
      .filter(a => a.pizzaId === selectedPizzaId && a.status !== "completed")
      .reduce((sum, a) => sum + a.quantity, 0);
    const effective = pizzas[pizzaIndex].quantity - completed;
    const available = effective - active;
    const toArchive = Math.min(count, available);
    if (toArchive <= 0) return;
    if (archivedIndex > -1) {
      allocations[archivedIndex].quantity += toArchive;
    } else {
      allocations.push({
        pizzaId: selectedPizzaId,
        orderId: 'archived',
        quantity: toArchive,
        status: 'completed'
      });
    }
    await updateDoc(batchRef, {
      pizza_allocations: allocations,
      pizzas: pizzas
    });
    const updatedBatch = {
      ...selectedBatch,
      pizza_allocations: allocations,
      pizzas: pizzas
    };
    setSelectedBatch(updatedBatch);
    setStock(prevStock =>
      prevStock.map(batch =>
        batch.id === selectedBatch.id
          ? {
              ...batch,
              pizza_allocations: allocations,
              pizzas: pizzas
            }
          : batch
      )
    );
  } catch (error) {
    console.error("❌ Error adjusting archive (batch):", error);
  }
};

const doPlusArchiveBatch = async () => {
  const count = plusArchiveCountRef.current;
  if (count === 0) return;
  plusArchiveCountRef.current = 0;
  try {
    const batchRef = doc(db, "batches", selectedBatch.id);
    const batchSnap = await getDoc(batchRef);
    const batchData = batchSnap.data();
    const allocations = [...(batchData.pizza_allocations || [])];
    const pizzas = [...(batchData.pizzas || [])];
    const pizzaIndex = pizzas.findIndex(p => p.id === selectedPizzaId);
    const archivedIndex = allocations.findIndex(a =>
      a.pizzaId === selectedPizzaId &&
      a.orderId === 'archived' &&
      a.status === 'completed'
    );
    if (archivedIndex === -1) return;
    const toUnarchive = Math.min(count, allocations[archivedIndex].quantity);
    allocations[archivedIndex].quantity -= toUnarchive;
    if (allocations[archivedIndex].quantity <= 0) {
      allocations.splice(archivedIndex, 1);
    }
    await updateDoc(batchRef, {
      pizza_allocations: allocations,
      pizzas: pizzas
    });
    const updatedBatch = {
      ...selectedBatch,
      pizza_allocations: allocations,
      pizzas: pizzas
    };
    setSelectedBatch(updatedBatch);
    setStock(prevStock =>
      prevStock.map(batch =>
        batch.id === selectedBatch.id
          ? {
              ...batch,
              pizza_allocations: allocations,
              pizzas: pizzas
            }
          : batch
      )
    );
  } catch (error) {
    console.error("❌ Error adjusting archive (plus batch):", error);
  }
};






  return (
    <div className='inventory navContent'>
      <h2>INVENTORY</h2>

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

        <div className='inventoryBox' id='totals'>
        <p>Total Stock: {totalStockOverall}</p>
        <p>Total On Order: {totalOnOrderOverall}</p>
        <p>Total Available: {totalAvailableOverall}</p>
        </div>
      <div>
      </div>
      {pizzaData.length > 0 ? (
        <div className='inventoryContainer'>
          {pizzaData
          .filter(pizza => {
            if (sleeveFilter === 'sleeve') return pizza.sleeve === true;
            if (sleeveFilter === 'noSleeve') return pizza.sleeve === false;
            return true; // 'all'
          })
          .slice() // make a copy so you don't mutate state
          .sort((a, b) => {
            // Sleeved first, then sleeveless
            if (a.sleeve !== b.sleeve) return b.sleeve - a.sleeve;
            // For sleeved, put DOU_A1 last
            if (a.sleeve && a.id === "DOU_A1") return 1;
            if (b.sleeve && b.id === "DOU_A1") return -1;
            // For sleeveless, put DOU_A0 last
            if (!a.sleeve && a.id === "DOU_A0") return 1;
            if (!b.sleeve && b.id === "DOU_A0") return -1;
            // Otherwise, alphabetical
            return a.id.localeCompare(b.id);
          })
          .map((pizza, pizzaIndex) => {
            let totalStock = 0;
            let totalOnOrder = 0;
            let totalAvailable = 0;


return (
            <div 
              className='pizzas' 
              id={`pizzas${pizza.id}`} 
              key={pizzaIndex} 
              style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent', border: pizza.sleeve ? 'transparent' : `2px dotted ${pizza.hex_colour}` }}
            >
                <div className='pizzaHeader'>
                  <h4 className='pizzaH4' style={{ color: pizza.sleeve ? `#fdfdfd` : `${pizza.hex_colour}` }}>{pizza.pizza_title}</h4>
                </div>
              <div className='pizzaContent' style={{ backgroundColor: pizza.sleeve ? `${pizza.hex_colour}f2` : 'transparent'}}>

                {/* Render inventory details for this pizza */}
                {stock
                  .filter(batch => {
                      if (!batch.completed) return false;

                      const match = batch.pizzas.find(p => p.id === pizza.id);
                      if (!match) return false;

                      const completed = (batch.pizza_allocations || [])
                        .filter(a => a.pizzaId === pizza.id && a.status === "completed")
                        .reduce((sum, a) => sum + a.quantity, 0);

                      const effectiveQuantity = match.quantity - completed;
                      return effectiveQuantity > 0;
                    })
                  .sort((a, b) => b.batch_code.localeCompare(a.batch_code)) // Sort batches by batch_code in descending order
                  .map((batch, index) => (
                    <div className='inventoryBox' 
                    style={{ backgroundColor: pizza.sleeve ? pizza.hex_colour : 'transparent', cursor: 'pointer'}} key={`${pizza.id}-${index}`}
                    onClick={() => {
                      setSelectedBatch(batch);
                      setSelectedPizzaId(pizza.id);
                      setShowArchiveModal(true);
                    }}
                    >
                      <p>Batch Number: {batch.batch_code}</p>
                      {batch.pizzas.map((p, idx) => (
                        p.id === pizza.id && p.quantity > 0 ? (
                          <div key={idx} className='container'>
                          {(() => {
                            const allocations = (batch.pizza_allocations || []);
                            // Only include allocations for this pizza AND this batch
                            const batchAllocations = allocations.filter(
                              a => a.pizzaId === p.id
                            );

                            const completed = batchAllocations
                              .filter(a => a.status === "completed")
                              .reduce((sum, a) => sum + a.quantity, 0);

                            const active = batchAllocations
                              .filter(a => a.status === "incomplete")
                              .reduce((sum, a) => sum + a.quantity, 0);

                            const effectiveQuantity = p.quantity - completed;
                            const available = effectiveQuantity - active;

                            return (
                              <>
                                <p>Total: {effectiveQuantity}</p>
                                <p>On order: {active}</p>
                                <p>Available: {available}</p>
                              </>
                            );
                          })()}
                          </div>
                        ) : null
                      ))}
                    </div>
                ))}
              </div>
                {/* Render pizza totals */}
                <div className='inventoryBox' id='totals'>
                  {(() => {
                    let pizzaStock = 0;
                    let pizzaAllocated = 0;
                    let pizzaAvailable = 0;

                    stock.forEach((batch) => {
                      if (batch.completed) {
                        const match = batch.pizzas.find(p => p.id === pizza.id);
                        if (match) {
                          const allocations = batch.pizza_allocations || [];
                          const completedQty = allocations
                            .filter(a => a.pizzaId === pizza.id && a.status === "completed")
                            .reduce((sum, a) => sum + a.quantity, 0);
                          const activeQty = allocations
                            .filter(a => a.pizzaId === pizza.id && a.status !== "completed")
                            .reduce((sum, a) => sum + a.quantity, 0);
                          const effectiveQuantity = match.quantity - completedQty;

                          pizzaStock += effectiveQuantity;
                          pizzaAllocated += activeQty;
                          pizzaAvailable += effectiveQuantity - activeQty;
                        }
                      }
                    });


                    return (
                    <>
                      <p>Total Stock: {pizzaStock}</p>
                      <p>Total On Order: {pizzaAllocated}</p>
                      <p>Total Available: {pizzaAvailable}</p>
                    </>
                    );
                  })()}
                </div>
            </div>
          );
        })}
        </div>
      ) : (
        <p>Loading pizza data...</p>
      )}


{/* show batch allocations & archive modal */}
    {showArchiveModal && selectedBatch && (() => {
      const match = selectedBatch.pizzas.find(p => p.id === selectedPizzaId);
      const total = match?.quantity || 0;

      const completed = (selectedBatch.pizza_allocations || [])
        .filter(a => a.pizzaId === selectedPizzaId && a.status === "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const active = (selectedBatch.pizza_allocations || [])
        .filter(a => a.pizzaId === selectedPizzaId && a.status !== "completed")
        .reduce((sum, a) => sum + a.quantity, 0);

      const effective = total - completed;
      const available = effective - active;

      const hasArchivedAllocation = (selectedBatch.pizza_allocations || []).some(
        a => a.pizzaId === selectedPizzaId &&
            a.orderId === 'archived' &&
            a.status === 'completed' &&
            a.quantity > 0
      );

      return (
      <div 
        className="modal"
        onClick={(e) => {
          if (e.target.className === 'modal') {
            setShowArchiveModal(false);
            setSelectedBatch(null);
          }
        }}
      >
            <div className="modalContent archiveModal"
              style={{
                backgroundColor: pizzaData.find(p => p.id === selectedPizzaId)?.hex_colour || '#fff',
                padding: '20px',
                borderRadius: '10px'
              }}
            >
              <h3>{selectedPizzaId} : batch {selectedBatch.batch_code}</h3>
              <h5><strong>Allocations: </strong></h5>
              {(selectedBatch.pizza_allocations || [])
                .filter(a => a.pizzaId === selectedPizzaId)
                .map(a => {
                  const linkedOrder = orders.find(o => o.id === a.orderId);
                  let accountName = linkedOrder?.customer_name || (a.orderId === 'archived' ? 'archived' : 'unknown');
                  if (accountName === 'SAMPLES' && linkedOrder?.sample_customer_name) {
                    accountName = `SAMPLES: ${linkedOrder.sample_customer_name}`;
                  }
                  
                  // Format delivery date from yyyy-mm-dd to dd-mm-yyyy
                  let deliveryDay = linkedOrder?.delivery_day || (a.orderId === 'archived' ? 'archived' : 'unknown');
                  if (deliveryDay !== 'archived' && deliveryDay !== 'unknown' && deliveryDay !== 'tbc' && deliveryDay && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDay)) {
                    const [year, month, day] = deliveryDay.split('-');
                    deliveryDay = `${day}-${month}-${year}`;
                  }
                  
                  return {
                    ...a,
                    accountName,
                    deliveryDay
                  };
                })
                .sort((a, b) => a.accountName.localeCompare(b.accountName))
                .map((a, i) => (
                  <p key={i}>
                    <strong>{a.accountName}: {a.quantity}</strong> {a.deliveryDay}
                  </p>
                ))}
              <div style={{ marginTop: '1rem' }}>
                <p><strong>Total:</strong> {effective}</p>
                <p><strong>On order:</strong> {active}</p>
                <div className='availableControls'>
                  <p className='available'><strong>Available:</strong> {available} </p>
                    <p onClick={() => adjustArchive(-1)} disabled={available <= 0} className='minusArch'> − </p>{' '}
                    <p onClick={() => adjustArchive(1)} disabled={!hasArchivedAllocation} className='plusArch'> + </p>
              </div>
              </div>
            </div>
          </div>
        );
      })()}

      
    </div>
  );
}

export default Inventory;