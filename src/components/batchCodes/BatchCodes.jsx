import './batchCodes.css'
import { app, db } from '../firebase/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from '@firebase/firestore';
import { useState, useEffect, useRef } from 'react';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';

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
  const formRef = useRef(null);
  const [showBatch, setShowBatch] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(null);
  const [totalPizzas, setTotalPizzas] = useState(0);
  const [selectedPizzas, setSelectedPizzas] = useState([]);
  const [consolidatedIngredients, setConsolidatedIngredients] = useState([]);
  const [ingredientBatchCodes, setIngredientBatchCodes] = useState({});
  const [loading, setLoading] = useState(true);

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
  };

  // if user clicks edit
  const handleEditClick = (batch) => {
    setEditBatch(batch);
    setShowForm(true); // Show the form
    setSaveNewMode(false); // Set mode to edit
    setBatchDate(batch.batch_date); // Set batch date for edit
    setNumPizzas(batch.num_pizzas); // Set number of pizzas for edit
    setBatchCode(batch.batch_code); // Set batch code for edit
    setCompleted(batch.completed);
    setIngredientsOrdered(batch.ingredients_ordered || false); // Set ingredients ordered checkbox
  
    // Update pizzas state with batch data
    const updatedPizzas = pizzas.map(pizza => {
      const matchingPizza = batch.pizzas.find(p => p.id === pizza.id);
      return {
        ...pizza,
        quantity: matchingPizza ? matchingPizza.quantity : 0,
        ingredientBatchCodes: matchingPizza ? matchingPizza.ingredientBatchCodes : {}
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

  const handleBatchCodeChange = (e, ingredientName) => {
    const { value } = e.target;
    setIngredientBatchCodes(prevBatchCodes => ({
      ...prevBatchCodes,
      [ingredientName]: value
    }));
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
    setShowBatch(true);
    setCurrentBatch(batch);
    console.log(currentBatch);
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
        pizzas: pizzas.map(pizza => ({
          id: pizza.id,
          quantity: pizza.quantity,
          pizza_title: pizza.pizza_title,
          sleeve: pizza.sleeve,
          ingredients: pizza.ingredients,
          ingredientBatchCodes: pizza.ingredients.reduce((acc, ingredient) => {
            acc[ingredient] = ingredientBatchCodes[ingredient] || "";
            return acc;
          }, {})
        }))
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setSaveNewMode(false);
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
        pizzas: pizzas.map(pizza => ({
          id: pizza.id,
          quantity: pizza.quantity,
          pizza_title: pizza.pizza_title,
          sleeve: pizza.sleeve,
          ingredients: pizza.ingredients,
          ingredientBatchCodes: pizza.ingredients.reduce((acc, ingredient) => {
            acc[ingredient] = ingredientBatchCodes[ingredient] || "";
            return acc;
          }, {})
        }))
      });
      setShowForm(false);
      setEditBatch(null);
      setBatchDate("");
      setNumPizzas(0);
      setBatchCode("");
      setCompleted(false);
      setIngredientsOrdered(false);
      setSaveNewMode(false);
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

  const handleSubmitClick = (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    setCompleted(true); // Update state
    handleEditFormSubmit(); // Call your form submission function
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
      default:
        break;
    }
  };

  // Handle clicks outside the form
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (formRef.current && !formRef.current.contains(e.target)) {
        setShowForm(false);
      }
    };
    if (showForm) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showForm]);

  return (
    <div className='batchCodes'>
      <h2>BATCH CODES</h2>
      <button className='button' onClick={handleAddClick}>+</button>

      {showForm && (
  <form
    ref={formRef}
    onSubmit={saveNewMode ? handleAddFormSubmit : handleEditFormSubmit}
    className='editForm'
    as={Row}
  >
    <Form.Label column sm={3}>
      Batch Date:
    </Form.Label>
    <Col sm={9}>
      <input
        type="date"
        name="batch_date"
        value={batchDate}
        onChange={handleInputChange}
        required
      />
    </Col>
    <Form.Label column sm={3}>
      Number of Pizzas:
    </Form.Label>
    <Col sm={9}>
      {pizzas.map((pizza) => (
        <div key={pizza.id} className='container'>
          {pizza.pizza_title}
          <input
            className='inputNumber'
            type="number"
            name="quantity"
            value={pizza.quantity || ""}
            placeholder='0'
            onChange={(e) => handleQuantityChange(e, pizza.id)}
          />
        </div>
      ))}
      <div className='total'>
        <h6>Total: {totalPizzas}</h6>
      </div>
    </Col>

    {loading ? (
      <div>Loading...</div>
    ) : (
      <div>
        <Form.Label column sm={3}>
          Ingredients:
        </Form.Label>
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
              />
            </div>
          );
        })}
      </div>
    )}

    <Form.Label column sm={3}>
      Ingredients Ordered?
      <input
        className='m-2'
        type="checkbox"
        name='ingredients_ordered'
        checked={ingredientsOrdered}
        onChange={handleInputChange}
      />
    </Form.Label>

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


      <div>
        <div className='batchText batchHeader container'>
          <p>Batch Date:</p>
          <p>Number of pizzas:</p>
          <p>Ingredients Ordered?</p>
        </div>
      </div>

      {batches
        .sort((a, b) => new Date(a.batch_date) - new Date(b.batch_date))
        .map(batch => (
          <div key={batch.id} className={`batchDiv ${batch.completed ? 'completed' : 'draft'}`}>
            <button className={`batchText button ${batch.completed ? 'completed' : 'draft'} container`} onClick={() => handleBatchClick(batch)}>
              <p>{batch.batch_date}</p>
              <p>{batch.num_pizzas}</p>
              {batch.ingredients_ordered ? <p>✓</p> : <p>✘</p>}
            </button>
            <button className='button' onClick={() => handleEditClick(batch)}>edit</button>
          </div>
        ))}
    </div>
  );
}

export default BatchCodes;
