import './batchCodes.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from '@firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { FormLabel } from 'react-bootstrap';

function BatchCodes() {
  const [batches, setBatches] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [saveNewMode, setSaveNewMode] = useState(true);
  const [batchDate, setBatchDate] = useState("");
  const [numPizzas, setNumPizzas] = useState(0);
  const [ingredients, setIngredients] = useState([]);
  const [batchCode, setBatchCode] = useState("");
  const [completed, setCompleted] = useState(false);
  const [ingredientsOrdered, setIngredientsOrdered] = useState(false);
  const [notes, setNotes] = useState("");
  const formRef = useRef(null);
  // const [showBatch, setShowBatch] = useState(false);
  // const [currentBatch, setCurrentBatch] = useState(null);
  const [totalPizzas, setTotalPizzas] = useState(0);
  const [selectedPizzas, setSelectedPizzas] = useState([]);
  const [consolidatedIngredients, setConsolidatedIngredients] = useState([]);
  const [ingredientBatchCodes, setIngredientBatchCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewingBatch, setViewingBatch] = useState(null); // Track viewing mode
  const batchDetailsRef = useRef(null);

  // display all batches
  useEffect(() => {
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
    fetchBatches();
  

  // FETCH ingredients
    const fetchIngredients = async () => {
      setLoading(true); // Set loading to true at the start
      try {
        const querySnapshot = await getDocs(collection(db, "ingredients"));
        const ingredientsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setIngredients(ingredientsData);
      } catch (error) {
        console.error("Error fetching ingredients:", error);
      } finally {
        setLoading(false); // Set loading to false when done
      }
    };
    fetchIngredients();


    const fetchPizzas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "pizzas"));
        const pizzaData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
  
        // Sort pizzas: first those with sleeve true, then those with sleeve false, both alphabetically
        pizzaData.sort((a, b) => {
          if (a.sleeve === b.sleeve) {
            return a.pizza_title.localeCompare(b.pizza_title);
          }
  
          return a.sleeve ? -1 : 1;
        });
  
        setPizzas(pizzaData);
      } catch (error) {
        console.error("Error fetching pizzas:", error);
      }
    };
    fetchPizzas();
  }, []);
  
  

  const formatDateToBatchCode = (dateString) => {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return ''; // Return an empty string if the date is invalid
    }
    
    // Format as YYYYMMDD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  // Pizza weight const for form fields
  const handlePizzaWeightChange = (e, pizzaId, weightType) => {
    const { value } = e.target;
    setPizzas(prevPizzas =>
      prevPizzas.map(pizza =>
        pizza.id === pizzaId ? { ...pizza, [`${weightType}PizzaWeight`]: value } : pizza
      )
    );
  };

  useEffect(() => {
    // When batchDate changes, update the batchCode
    if (batchDate) {
      const formattedBatchCode = formatDateToBatchCode(batchDate);
      setBatchCode(formattedBatchCode);
    }
  }, [batchDate]);

  useEffect(() => {
    // When viewing batch state changes scroll it into view
    if (viewingBatch && batchDetailsRef.current) {
      batchDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [viewingBatch]);

  // if user clicks the add button
  const handleAddClick = () => {
    setShowForm(true); // Show the form
    setSaveNewMode(true); // Set mode to save a new batch
    setEditBatch(null); // Clear edit batch data
    setBatchDate(""); // Clear batch date
    setNumPizzas(0); // Clear number of pizzas
    setBatchCode(""); // Clear batch code
    setTotalPizzas(0) // Clear pizza total
    setIngredientsOrdered(false); // Clear ingredients ordered checkbox
    setSelectedPizzas([]);
    setPizzas(pizzas.map(pizza => ({ ...pizza, quantity: 0 })));
    setIngredientBatchCodes({});
    setNotes("")
  };

  // if user clicks edit
  const handleEditClick = (batch) => {
    setEditBatch(batch);
    setShowForm(true); // Show the form
    setViewingBatch(null)
    setSaveNewMode(false); // Set mode to edit
    setBatchDate(batch.batch_date); // Set batch date for edit
    setNumPizzas(batch.num_pizzas); // Set number of pizzas for edit
    setBatchCode(batch.batch_code); // Set batch code for edit
    setCompleted(batch.completed);
    setIngredientsOrdered(batch.ingredients_ordered || false); // Set ingredients ordered checkbox
    setNotes(batch.notes)
    // Update pizzas state with batch data
    const updatedPizzas = pizzas.map(pizza => {
      const matchingPizza = batch.pizzas.find(p => p.id === pizza.id);
      return {
        ...pizza,
        quantity: matchingPizza ? matchingPizza.quantity : 0,
        ingredientBatchCodes: matchingPizza ? matchingPizza.ingredientBatchCodes : {},
        firstPizzaWeight: matchingPizza ? matchingPizza.firstPizzaWeight : "",
        middlePizzaWeight: matchingPizza ? matchingPizza.middlePizzaWeight : "",
        lastPizzaWeight: matchingPizza ? matchingPizza.lastPizzaWeight : "",
      };
    });
    
    setPizzas(updatedPizzas);
  
    // Extract and consolidate ingredients from batch.pizzas
    const allIngredients = batch.pizzas.flatMap(pizza => pizza.ingredients);
  
    // Count the occurrences of each ingredient
    const ingredientCounts = allIngredients.reduce((acc, ingredient) => {
      acc[ingredient] = (acc[ingredient] || 0) + 1;
      return acc;
    }, {});
  
    // Use the ingredient counts to update state or further processing
    const consolidatedIngredients = Object.keys(ingredientCounts).map(ingredientName => {
      const ingredientData = ingredients.find(ing => ing.name === ingredientName);
      if (ingredientData) {
        const { gramsPerPizza, unitWeight } = parseIngredientRatio(ingredientData.ratio);
        return {
          name: ingredientName,
          quantity: ingredientCounts[ingredientName] * gramsPerPizza, // Total grams needed
          unit: ingredientData.packaging,
          unitWeight: unitWeight
        };
      }
      return null;
    }).filter(Boolean);
  
    setConsolidatedIngredients(consolidatedIngredients);
  
    // Update selectedPizzas
    const newSelectedPizzas = updatedPizzas
      .filter(pizza => pizza.quantity > 0)
      .map(pizza => ({
        ...pizza,
        ingredientBatchCodes: pizza.ingredientBatchCodes
      }));
    setSelectedPizzas(newSelectedPizzas);
  
    // Update ingredient batch codes
    const newBatchCodes = {};
    batch.pizzas.forEach(pizza => {
      pizza.ingredients.forEach(ingredient => {
        if (pizza.ingredientBatchCodes && pizza.ingredientBatchCodes[ingredient]) {
          newBatchCodes[ingredient] = pizza.ingredientBatchCodes[ingredient];
        }
      });
    });
    setIngredientBatchCodes(newBatchCodes);
  
    // Calculate totalPizzas
    const newTotal = updatedPizzas.reduce((sum, pizza) => sum + (parseInt(pizza.quantity) || 0), 0);
    setTotalPizzas(newTotal);
  };
  


  const handleQuantityChange = (e, pizzaId) => {
    const { value } = e.target;
    const updatedPizzas = pizzas.map(pizza => {
      if (pizza.id === pizzaId) {
        return { ...pizza, quantity: parseInt(value) || 0 };
      }
      return pizza;
    });
  
    setPizzas(updatedPizzas);
  
    const newSelectedPizzas = updatedPizzas
    .filter(pizza => pizza.quantity > 0)
    .map(pizza => ({
      ...pizza,
      ingredientBatchCodes: pizza.ingredientBatchCodes
    }));
    setSelectedPizzas(newSelectedPizzas);

    consolidateIngredients(newSelectedPizzas); // Consolidate ingredients
  
    // Update the total pizzas count
    const newTotal = updatedPizzas.reduce((sum, pizza) => sum + (pizza.quantity || 0), 0);
    setTotalPizzas(newTotal);
  };


  const parseIngredientRatio = (ratioString) => {
    // Split the ratioString by ':' and trim whitespace
    const [gramsPerPizza, unitWeight] = ratioString.split(':').map(part => part.trim());
    // Convert gramsPerPizza to a number
    const gramsPerPizzaNumber = parseFloat(gramsPerPizza);
    // Convert unitWeight to a number (it's in kilograms)
    const unitWeightNumber = parseFloat(unitWeight);
    return {
      gramsPerPizza: gramsPerPizzaNumber,
      unitWeight: unitWeightNumber
    };
  };
  

  const calculateIngredientQuantities = (selectedPizzas) => {
    const ingredientQuantities = {};
  
    selectedPizzas.forEach(pizza => {
    pizza.ingredients.forEach(ingredientName => {
    const ingredientData = ingredients.find(ing => ing.name === ingredientName);
  
        if (ingredientData) {
          const { gramsPerPizza, unitWeight } = parseIngredientRatio(ingredientData.ratio);
  
          if (!ingredientQuantities[ingredientData.name]) {
            ingredientQuantities[ingredientData.name] = {
              quantity: 0,
              unit: ingredientData.packaging,
              unitWeight: unitWeight
            };
          }
          // Calculate total quantity required in grams
          ingredientQuantities[ingredientData.name].quantity += (gramsPerPizza * pizza.quantity);
        }
      });
    });
  
    // Convert quantities to kilograms
    Object.keys(ingredientQuantities).forEach(ingredient => {
      ingredientQuantities[ingredient].quantity /= 1000; // Convert grams to kilograms
    });
  
    return ingredientQuantities;
  };
  
  
  
  const formatQuantity = (quantity) => {
    return parseFloat(quantity).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };
  

   const consolidateIngredients = (selectedPizzas) => {
    const ingredientQuantities = calculateIngredientQuantities(selectedPizzas);

    const consolidated = Object.entries(ingredientQuantities).map(([ingredient, data]) => {
      return {
        name: ingredient,
        quantity: data.quantity,
        unit: data.unit,
        unitWeight: data.unitWeight
      };
    });

    setConsolidatedIngredients(consolidated);
  };

  
  
  
  
  const handleIngredientBatchCodeChange = (e, ingredient) => {
    const { value } = e.target;
    setIngredientBatchCodes(prevBatchCodes => ({
      ...prevBatchCodes,
      [ingredient]: value
    }));
  
    // Update selected pizzas with the new ingredient batch code
    setSelectedPizzas(prevSelectedPizzas =>
      prevSelectedPizzas.map(pizza => ({
        ...pizza,
        ingredientBatchCodes: {
          ...pizza.ingredientBatchCodes,
          [ingredient]: value
        }
      }))
    );
  };
  

  const handleBatchClick = (batch) => {
    setViewingBatch({
      ...batch,
      ingredientBatchCodes: batch.pizzas.reduce((acc, pizza) => {
        pizza.ingredients.forEach(ingredient => {
          if (pizza.ingredientBatchCodes && pizza.ingredientBatchCodes[ingredient]) {
            acc[ingredient] = pizza.ingredientBatchCodes[ingredient];
          }
        });
        return acc;
      }, {})
    });
  };

  const handleAddFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Add new batch
      await addDoc(collection(db, "batches"), {
        batch_date: batchDate,
        num_pizzas: totalPizzas,
        batch_code: batchCode,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
        pizzas: pizzas.filter(pizza => pizza.quantity > 0).map(pizza => ({
          id: pizza.id,
          quantity: pizza.quantity,
          quantity_on_order: 0,
          pizza_title: pizza.pizza_title,
          sleeve: pizza.sleeve,
          ingredients: pizza.ingredients,
          ingredientBatchCodes: pizza.ingredients.reduce((acc, ingredient) => {
            acc[ingredient] = ingredientBatchCodes[ingredient] || "";
            return acc;
          }, {}),
          firstPizzaWeight: pizza.firstPizzaWeight || null,
          middlePizzaWeight: pizza.middlePizzaWeight || null,
          lastPizzaWeight: pizza.lastPizzaWeight || null,
        })),
        notes: notes,
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setSaveNewMode(false);
      setNotes("")
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error submitting batch:", error);
    }
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update existing batch
      const batchRef = doc(db, "batches", editBatch.id);
      await updateDoc(batchRef, {
        batch_date: batchDate,
        num_pizzas: totalPizzas,
        batch_code: batchCode,
        completed: completed,
        ingredients_ordered: ingredientsOrdered,
        pizzas: pizzas.filter(pizza => pizza.quantity > 0).map(pizza => ({
          id: pizza.id,
          quantity: pizza.quantity,
          quantity_on_order: 0,
          pizza_title: pizza.pizza_title,
          sleeve: pizza.sleeve,
          ingredients: pizza.ingredients,
          ingredientBatchCodes: pizza.ingredients.reduce((acc, ingredient) => {
            acc[ingredient] = ingredientBatchCodes[ingredient] || "";
            return acc;
          }, {}),
          firstPizzaWeight: pizza.firstPizzaWeight || null,
          middlePizzaWeight: pizza.middlePizzaWeight || null,
          lastPizzaWeight: pizza.lastPizzaWeight || null,
        })),
        notes: notes,
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setSaveNewMode(false);
      setNotes("")
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error updating batch:", error);
    }
  };


  const handleDeleteForm = async () => {
    try {
      const batchRef = doc(db, "batches", editBatch.id);
      await deleteDoc(batchRef);
      setShowForm(false);
      setEditBatch(null);
      const querySnapshot = await getDocs(collection(db, "batches"));
      const batchesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error deleting batch:", error);
    }
  };

  // Handle input changes for both new and edit forms
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    switch (name) {
      case "batch_date":
        setBatchDate(value);
        break;
      case "num_pizzas":
        setNumPizzas(value);
        break;
      case "ingredients":
        setIngredients(value);
        break;
      case "batch_code":
        setBatchCode(value);
        break;
      case "ingredients_ordered":
        setIngredientsOrdered(checked);
        break;
      case "notes":
        setNotes(value);  // Update state for notes
        break;
      default:
        break;
    }
  };

  // Handle clicks outside the form
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        (formRef.current && !formRef.current.contains(e.target)) ||
        (batchDetailsRef.current && !batchDetailsRef.current.contains(e.target))
      ) {
        setShowForm(false);
        setViewingBatch(null);
      }
    };
  
    if (showForm || viewingBatch) {
      document.addEventListener("mousedown", handleClickOutside);
    }
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm, viewingBatch]);
  
  return (
    <div className='batchCodes'>
      <h2>BATCH CODES</h2>
      
      <button className='button' onClick={handleAddClick}>+</button>
      
      {viewingBatch && !showForm && (
        <div className="batchDetails border" ref={batchDetailsRef}>
          <h2>Batch Details</h2>
          <button className='button' onClick={() => handleEditClick(viewingBatch)}>Edit</button>
          <div className="detailRow">
            <p><strong>Batch Code:</strong> {viewingBatch.batch_code}</p>
          </div>
          <div className="detailRow">
            <p><strong>Batch Date:</strong> {viewingBatch.batch_date}</p>
            <p><strong>Completed:</strong> {viewingBatch.completed ? 'Yes' : 'No'}</p>
            <p><strong>Ingredients Ordered:</strong> {viewingBatch.ingredients_ordered ? 'Yes' : 'No'}</p>
          </div>
          <div className='pizzaDisplayTitles'> 
            <h4 className='pizzaWeightsOuter'>Pizzas:</h4>
            <h6 className='pizzaWeightsOuter pizzaWeights'>Pizza Weights:</h6>
          </div>
          {viewingBatch.pizzas.filter(pizza => pizza.quantity > 0).map(pizza => (
            <div key={pizza.id} className='pizzaDetails'>
              <p><strong>{pizza.pizza_title}</strong>: {pizza.quantity} </p>
              <div className='pizzaWeightsOuter'>
                <div className='pizzaWeights'>
                  <p>
                    <strong>First:{" "}</strong>
                    {Number(pizza.firstPizzaWeight) > 0 ? `${pizza.firstPizzaWeight}g`: <span style={{ color: 'red' }}>-</span>}
                  </p>
                  <p>
                    <strong>Middle:{" "}</strong>
                    {Number(pizza.middlePizzaWeight) > 0 ? `${pizza.middlePizzaWeight} g` : <span style={{ color: 'red' }}>-</span>}
                  </p>
                  <p>
                    <strong>Last:{" "}</strong>
                    {Number(pizza.lastPizzaWeight) > 0 ? `${pizza.lastPizzaWeight} g` : <span style={{ color: 'red' }}>-</span>}
                  </p>
                </div> 
              </div>
            </div>
          ))}
          <p className="alignRight"><strong>Total Pizzas:</strong> {viewingBatch.num_pizzas}</p>
          <h4>Batch Codes:</h4>
          {ingredients
            .filter(ingredient => viewingBatch.pizzas.some(pizza => pizza.quantity > 0 && pizza.ingredients.includes(ingredient.name)))
            .map(ingredient => {
              const batchCode = viewingBatch.pizzas
                .flatMap(pizza => pizza.ingredients.includes(ingredient.name) ? pizza.ingredientBatchCodes[ingredient.name] : [])
                .find(code => code);
              const ingredientQuantity = calculateIngredientQuantities(viewingBatch.pizzas)[ingredient.name] || { quantity: 0, unitWeight: 1, unit: '' };
              const numberOfUnits = ingredientQuantity.quantity / ingredientQuantity.unitWeight;
  
              return (
                <div key={ingredient.id} className='ingredient container' style={{ color: batchCode ? 'inherit' : 'red' }}>
                  <p>
                    <strong>{ingredient.name}:</strong>  {formatQuantity(numberOfUnits)} {ingredientQuantity.unit} 
                  </p>
                  <p>{batchCode ? `# ${batchCode}` : "!"}</p>
                </div>
              );
            })}
          <p><strong>Notes:</strong> {viewingBatch.notes}</p>
        </div>
      )}
  
      {showForm && (
        <form
          ref={formRef}
          onSubmit={saveNewMode ? handleAddFormSubmit : handleEditFormSubmit}
          className='editForm'
          as={Row}
        >
          <Form.Label column sm={3}><strong>Batch Code:</strong></Form.Label>
          <Col>
            <div># {batchCode}</div>
          </Col>
          <div>
          <Form.Label column sm={3}><strong>Batch Date:</strong></Form.Label>
          <Col>
            <input
              type="date"
              name="batch_date"
              value={batchDate}
              onChange={handleInputChange}
              required
            />
          </Col>
          <Form.Label column sm={3}>
            <strong>Ingredients Ordered?</strong>
            <input
              className='m-2'
              type="checkbox"
              name='ingredients_ordered'
              checked={ingredientsOrdered}
              onChange={handleInputChange}
            />
          </Form.Label>
          </div>
          <Form.Label column sm={3}><strong>Number of Pizzas:</strong></Form.Label>
          <Col>
          {pizzas.map((pizza) => (
          <div key={pizza.id} className='pizzaDetails'>
            <div className="pizza-info">
              <strong>{pizza.pizza_title}</strong>
              <input
                className='inputNumber'
                type="number"
                name="quantity"
                value={pizza.quantity || ""}
                placeholder='0'
                onChange={(e) => handleQuantityChange(e, pizza.id)}
              />
            </div>
            {Number(pizza.quantity) > 0 && (
              <div className="pizza-weights">
                <div>
                  <label>First</label>
                  <input
                    type="number"
                    className="inputNumber"                    
                    value={pizza.firstPizzaWeight || ""}
                    placeholder="0"
                    onChange={(e) => handlePizzaWeightChange(e, pizza.id, 'first')}
                  />g
                </div>
                <div>
                  <label>Middle</label>
                  <input
                    type="number"
                    className="inputNumber"                    
                    value={pizza.middlePizzaWeight || ""}
                    placeholder="0"
                    onChange={(e) => handlePizzaWeightChange(e, pizza.id, 'middle')}
                  />g
                </div>
                <div>
                  <label>Last</label>
                  <input
                    type="number"
                    className="inputNumber"
                    value={pizza.lastPizzaWeight || ""}
                    placeholder="0"
                    onChange={(e) => handlePizzaWeightChange(e, pizza.id, 'last')}
                  />g
                </div>
              </div>
            )}
          </div>
        ))}


            <div className='total'>
              <h6><strong>Total: </strong>{totalPizzas}</h6>
            </div>
          </Col>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div>
              <Form.Label column sm={3}><strong>Ingredients:</strong></Form.Label>
              {Object.entries(calculateIngredientQuantities(selectedPizzas)).map(([ingredient, { quantity, unitWeight, unit }]) => {
                const numberOfUnits = quantity / unitWeight;
                return (
                  <div key={ingredient} className='ingredient container'>
                    <h5><span className='fadedText'>{formatQuantity(numberOfUnits)} {unit} </span>{ingredient}</h5>
                    <input
                      type="text"
                      placeholder="Batch Code"
                      value={ingredientBatchCodes[ingredient] || ""}
                      onChange={(e) => handleIngredientBatchCodeChange(e, ingredient)}
                      className='ingredientBatchCode'
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="notes"
              value={notes}
              placeholder="Enter your notes here..."
              onChange={handleInputChange}
            />
          </div>
          <div className='container'>
            {saveNewMode ? (
              <button
                type="button"
                className='button draft'
                onClick={handleAddFormSubmit}
              >
                Save as draft
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className='button draft'
                  onClick={handleEditFormSubmit}
                >
                  Save draft
                </button>
                <button
                  type="submit"
                  className='button'
                  onClick={() => setCompleted(true)}
                >
                  Submit
                </button>
                <button
                  type="button"
                  className='button draft'
                  onClick={handleDeleteForm}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </form>
      )}
  
      <div className='batchHeader container'>
        <p>Batch Date:</p>
        <p>Pizzas:</p>
        <p>Ingredients Ordered?</p>
      </div>
      {batches.length > 0 ? (
        batches
        .sort((a, b) => new Date(b.batch_date) - new Date(a.batch_date))
        .map(batch => (
          <div key={batch.id} className={`batchDiv ${batch.completed ? 'completed' : 'draft'}`}>
            <button className={`batchText button ${batch.completed ? 'completed' : 'draft'} container`} onClick={() => handleBatchClick(batch)}>
              <p className='batchTextBoxes'>{batch.batch_date}</p>
              <p className='batchTextBoxCenter'>{batch.num_pizzas}</p>
              {batch.ingredients_ordered ? <p className='batchTextBoxEnd'>✓</p> : <p className='batchTextBoxEnd'>✘</p>}
            </button>
          </div>
        ))
      ) : (
        <p className='py-3'>Loading batches...</p>
      )}
    </div>
  );
  
}

export default BatchCodes;
